// Push notifications through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
// Sending never blocks or fails the request that caused it: callers use notify*()
// after their transaction has committed, and errors are only logged.
//
// PUSH_DRIVER: expo (default) | mock (tests: kept in memory) | off
import prisma from "../db/db.config";
import { logError } from "../utils/logger";
import { orderDistrict } from "./ubDistricts";

export type PushApp = "client" | "nurse";
export interface PushMessage {
  title: string;
  body: string;
  // read by the apps to open the right screen
  data: { type: "ORDER" | "OFFER" | "APPLICATION"; orderId?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo accepts at most 100 messages per request

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]). */
export const isExpoPushToken = (t: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(t);

const driver = () => {
  const d = process.env.PUSH_DRIVER || (process.env.NODE_ENV === "test" ? "mock" : "expo");
  return d === "mock" || d === "off" ? d : "expo";
};

/** Test helper: messages "sent" with PUSH_DRIVER=mock. */
export const pushOutbox: { to: string; userId: string; app: PushApp; message: PushMessage }[] = [];

async function deliver(rows: { token: string; userId: string; app: string }[], message: PushMessage) {
  if (rows.length === 0) return;
  const mode = driver();
  if (mode === "off") return;
  if (mode === "mock") {
    for (const r of rows) pushOutbox.push({ to: r.token, userId: r.userId, app: r.app as PushApp, message });
    return;
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(
        chunk.map((r) => ({
          to: r.token,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: "default",
          priority: "high",
          channelId: "default",
        })),
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`expo push http ${res.status}`);
    const json = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
    // A token Expo no longer knows (app removed, sign-in elsewhere) is dropped.
    const gone = (json?.data ?? [])
      .map((ticket, idx) => (ticket?.details?.error === "DeviceNotRegistered" ? chunk[idx]?.token : null))
      .filter((t): t is string => !!t);
    if (gone.length > 0) await prisma.pushDevice.deleteMany({ where: { token: { in: gone } } });
  }
}

/** Sends one message to every device of these users in one app. Never throws. */
export async function sendToUsers(userIds: string[], app: PushApp, message: PushMessage): Promise<void> {
  try {
    if (userIds.length === 0) return;
    const rows = await prisma.pushDevice.findMany({
      // a deactivated account gets nothing
      where: { userId: { in: [...new Set(userIds)] }, app, user: { deletedAt: null } },
      select: { token: true, userId: true, app: true },
    });
    await deliver(rows, message);
  } catch (err) {
    logError("push.send", err);
  }
}

// ---------------------------------------------------------------------------
// Messages (Mongolian, shown on the lock screen: no patient details)

const CLIENT_STATUS: Record<string, { title: string; body: string }> = {
  // back to PAID only when the assigned nurse withdrew before the visit
  PAID: {
    title: "Сувилагч солигдож байна",
    body: "Томилогдсон сувилагч гарсан тул өөр сувилагч хайж байна. Танд нэмэлт зардал гарахгүй.",
  },
  NO_SHOW: {
    title: "Сувилагч таныг олсонгүй",
    body: "Сувилагч хаяг дээр ирсэн боловч уулзаж чадсангүй. Дэлгэрэнгүйг аппаас харна уу.",
  },
  ASSIGNED: { title: "Сувилагч олдлоо", body: "Таны дуудлагыг сувилагч хүлээн авлаа." },
  EN_ROUTE: { title: "Сувилагч замдаа гарлаа", body: "Сувилагч тань руу явж байна." },
  IN_PROGRESS: { title: "Үйлчилгээ эхэллээ", body: "Сувилагч хаяг дээр ирж, үйлчилгээ эхэлсэн." },
  COMPLETED: { title: "Үйлчилгээ дууслаа", body: "Үзлэгийн тэмдэглэл аппад орлоо." },
  REFUSED: {
    title: "Үйлчилгээ хийгдсэнгүй",
    body: "Сувилагч үйлчилгээг хийх боломжгүй гэж үзлээ. Дэлгэрэнгүйг аппаас харна уу.",
  },
  INCIDENT: {
    title: "Үзлэг зогслоо",
    body: "Үзлэгийн үеэр асуудал гарсан. Компани тантай холбогдоно.",
  },
};

/** Tells the customer about a new order status. */
export function notifyOrderStatus(order: { id: string; childId: string; status: string }): Promise<void> {
  const text = CLIENT_STATUS[order.status];
  if (!text) return Promise.resolve();
  return sendToUsers([order.childId], "client", { ...text, data: { type: "ORDER", orderId: order.id } });
}

/** Tells nurses a call was offered to them (dispatch wave). */
export function notifyOffer(
  nurseIds: string[],
  order: { id: string; addressText: string | null; serviceNames: string[] },
): Promise<void> {
  const district = orderDistrict(order.addressText);
  const what = order.serviceNames.join(", ") || "Сувилгааны үйлчилгээ";
  return sendToUsers(nurseIds, "nurse", {
    title: "Шинэ дуудлага",
    body: district ? `${what} · ${district} дүүрэг` : what,
    data: { type: "OFFER", orderId: order.id },
  });
}

/** A cancelled order: its nurse stops, and the customer hears if staff cancelled it. */
export async function notifyOrderCancelled(
  order: { id: string; childId: string; assignedNurseId: string | null },
  by: "CLIENT" | "ADMIN" | "SYSTEM",
): Promise<void> {
  if (order.assignedNurseId)
    await sendToUsers([order.assignedNurseId], "nurse", {
      title: "Дуудлага цуцлагдлаа",
      body: "Энэ дуудлага руу явах шаардлагагүй.",
      data: { type: "ORDER", orderId: order.id },
    });
  if (by === "ADMIN")
    await sendToUsers([order.childId], "client", {
      title: "Захиалга цуцлагдлаа",
      body: "Дэлгэрэнгүй болон мөнгө буцаалтыг аппаас харна уу.",
      data: { type: "ORDER", orderId: order.id },
    });
  if (by === "SYSTEM")
    await sendToUsers([order.childId], "client", {
      title: "Сувилагч олдсонгүй",
      body: "Захиалсан цагт сувилагч олдоогүй тул захиалга цуцлагдаж, төлбөр бүрэн буцаагдана.",
      data: { type: "ORDER", orderId: order.id },
    });
}

/** Paid a while ago and still no nurse: the customer may wait or cancel for free. */
export function notifyNoNurseYet(order: { id: string; childId: string }): Promise<void> {
  return sendToUsers([order.childId], "client", {
    title: "Сувилагч хайсаар байна",
    body: "Одоогоор сувилагч олдоогүй байна. Хүлээх эсвэл захиалгаа цуцалж төлбөрөө бүрэн буцаан авах боломжтой.",
    data: { type: "ORDER", orderId: order.id },
  });
}

/** Tells a nurse an admin assigned a call to them. */
export function notifyAssignedNurse(nurseId: string, orderId: string): Promise<void> {
  return sendToUsers([nurseId], "nurse", {
    title: "Танд дуудлага томилогдлоо",
    body: "Дэлгэрэнгүйг аппаас харна уу.",
    data: { type: "ORDER", orderId },
  });
}

const APPLICATION: Record<string, { title: string; body: string }> = {
  APPROVED: {
    title: "Бүртгэл баталгаажлаа",
    body: "Та одоо «Идэвхтэй болох» дарж дуудлага авах боломжтой.",
  },
  REJECTED: {
    title: "Өргөдөл буцаагдлаа",
    body: "Шалтгааныг аппаас харж, засаад дахин илгээнэ үү.",
  },
  SUSPENDED: { title: "Бүртгэл түр хаагдлаа", body: "Дэлгэрэнгүйг аппаас харна уу." },
};

/** Tells a nurse the admin decided on their application. */
export function notifyApplication(nurseId: string, action: "APPROVED" | "REJECTED" | "SUSPENDED"): Promise<void> {
  return sendToUsers([nurseId], "nurse", { ...APPLICATION[action], data: { type: "APPLICATION" } });
}
