// Audit trail of back-office actions (spec slides 98, 109: "эмзэг мэдээлэл үзэх
// бүр аудит", "эрх өөрчлөлт — super-admin + аудит"). One row per action: who,
// what, on which record, and the values before/after. Never health details,
// passwords or full bank account numbers.
import type { Prisma, PrismaClient } from "@prisma/client";

export const AUDIT_ACTIONS = {
  SETTING_UPDATED: "Тохиргоо өөрчилсөн",
  CATALOG_UPDATED: "Каталог өөрчилсөн",
  NURSE_APPROVED: "Сувилагч баталгаажуулсан",
  NURSE_REJECTED: "Сувилагчийн өргөдөл татгалзсан",
  NURSE_SUSPENDED: "Сувилагч түдгэлзүүлсэн",
  NURSE_DOCUMENT_VIEWED: "Сувилагчийн баримт үзсэн",
  ORDER_ASSIGNED: "Сувилагч гараар томилсон",
  ORDER_CANCELLED: "Захиалга цуцалсан",
  REFUND_RETRIED: "Буцаалтыг дахин оролдсон",
  REFUND_RESOLVED: "Буцаалтыг гараар хийсэн гэж тэмдэглэсэн",
  PAYOUT_RECORDED: "Сувилагчид шилжүүлэг бүртгэсэн",
  STAFF_CREATED: "Ажилтан нэмсэн",
  STAFF_UPDATED: "Ажилтны эрх, төлөв өөрчилсөн",
  STAFF_PASSWORD_SET: "Ажилтны нууц үг шинэчилсэн",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_ENTITIES = {
  setting: "Тохиргоо",
  service: "Үйлчилгээ",
  nurse: "Сувилагч",
  order: "Захиалга",
  refund: "Буцаалт",
  payout: "Шилжүүлэг",
  user: "Ажилтан",
} as const;
export type AuditEntity = keyof typeof AUDIT_ENTITIES;

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

type Db = Pick<PrismaClient, "auditLog"> | Pick<Prisma.TransactionClient, "auditLog">;

/** Writes one audit row; inside a transaction pass the transaction client. */
export function audit(db: Db, e: AuditEntry) {
  return (db as Pick<PrismaClient, "auditLog">).auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      ...(e.before !== undefined && { before: e.before }),
      ...(e.after !== undefined && { after: e.after }),
    },
  });
}
