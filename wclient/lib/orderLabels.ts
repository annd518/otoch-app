// Order status labels shared by the staff order list and the admin dashboard.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ноорог",
  PAID: "Төлбөр төлөгдсөн",
  ASSIGNED: "Сувилагч томилогдсон",
  IN_PROGRESS: "Үйлчилгээ эхэлсэн",
  COMPLETED: "Дууссан",
  BLOCKED_RED_FLAG: "Аюулын шинжээр зогссон",
  AWAITING_PAYMENT: "Төлбөр хүлээж байна",
  CANCELLED: "Цуцлагдсан",
  EXPIRED: "Хугацаа дууссан",
};

export const ORDER_STATUS_ORDER = [
  "AWAITING_PAYMENT",
  "PAID",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED_RED_FLAG",
  "CANCELLED",
  "EXPIRED",
  "DRAFT",
];

export const formatMnt = (n: number) =>
  `${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")}₮`;

export const formatUb = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("mn-MN", {
        timeZone: "Asia/Ulaanbaatar",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Тодорхойгүй";
