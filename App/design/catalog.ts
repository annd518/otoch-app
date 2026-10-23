export const groups = [
  {
    code: "GROUP_A",
    title: "Эмчийн заалтаар",
    description: "Тарилга, дусал, уян зүү",
  },
  {
    code: "GROUP_B",
    title: "Шарх, гуурс",
    description: "Боолт, гуурс, зондны арчилгаа",
  },
  {
    code: "GROUP_C",
    title: "Үнэлгээ, хяналт",
    description: "Амин үзүүлэлт, мэс заслын дараах эргэлт",
  },
  {
    code: "GROUP_D",
    title: "Асаргаа",
    description: "Хэвтрийн өвчтөн, ахмад настны сувилгаа",
  },
] as const;
export function orderStatus(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Ноорог",
    BLOCKED_RED_FLAG: "Аюулын шинжээр зогссон",
    AWAITING_PAYMENT: "Төлбөр хүлээж байна",
    PAID: "Төлбөр төлөгдсөн",
    ASSIGNED: "Сувилагч томилогдсон",
    EN_ROUTE: "Сувилагч замдаа",
    REFUSED: "Үйлчилгээнээс татгалзсан",
    INCIDENT: "Осол, хүндрэл бүртгэгдсэн",
    NO_SHOW: "Сувилагч таныг олсонгүй",
    IN_PROGRESS: "Үйлчилгээ эхэлсэн",
    COMPLETED: "Дууссан",
    CANCELLED: "Цуцлагдсан",
    EXPIRED: "Хугацаа дууссан",
  };
  return labels[status] ?? "Төлөв шинэчлэгдэж байна";
}
