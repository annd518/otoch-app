/**
 * Mongolian display labels for status / role / category values.
 * Only used for rendering — the underlying values (API, filters, comparisons) stay unchanged.
 */
const LABELS: Record<string, string> = {
  // Visit / report statuses
  PENDING: 'Хүлээгдэж буй',
  ASSIGNED: 'Томилогдсон',
  STARTED: 'Эхэлсэн',
  IN_PROGRESS: 'Явагдаж буй',
  WAITING_APPROVAL: 'Баталгаажуулалт хүлээж буй',
  REVISION_REQUIRED: 'Засвар шаардлагатай',
  APPROVED: 'Батлагдсан',
  COMPLETED: 'Дууссан',
  REPORTED: 'Тайлагнасан',
  VERIFIED: 'Баталгаажсан',
  ALL: 'Бүгд',
  Pending: 'Хүлээгдэж буй',
  'In Progress': 'Явагдаж буй',
  Completed: 'Дууссан',
  Scheduled: 'Товлогдсон',
  Assigned: 'Томилогдсон',
  Unassigned: 'Томилогдоогүй',
  'Pending Review': 'Хянагдахыг хүлээж буй',
  Approved: 'Батлагдсан',
  Rejected: 'Татгалзсан',
  // Nurse availability
  Available: 'Боломжтой',
  'On Visit': 'Үзлэгт явсан',
  'Off Duty': 'Ажлын бус цаг',
  // User status
  Active: 'Идэвхтэй',
  Inactive: 'Идэвхгүй',
  // Roles
  CHILD: 'Хүүхэд',
  NURSE: 'Сувилагч',
  MEDICAL_ADMIN: 'Эмнэлгийн админ',
  ADMIN: 'Админ',
  Patient: 'Өвчтөн',
  Nurse: 'Сувилагч',
  'Medical Admin': 'Эмнэлгийн админ',
  Child: 'Хүүхэд',
  Admin: 'Админ',
  // Regions
  North: 'Хойд',
  South: 'Өмнөд',
  East: 'Зүүн',
  West: 'Баруун',
  // Visit / test types
  BASIC: 'Энгийн',
  FULL: 'Бүрэн',
  'Check-up': 'Үзлэг',
  Diagnostic: 'Оношилгоо',
  'Follow-up': 'Давтан үзлэг',
  'Blood Sugar': 'Цусан дахь сахар',
  'Lipid Panel': 'Липидийн шинжилгээ',
  'Blood Test': 'Цусны шинжилгээ',
  'Urine Test': 'Шээсний шинжилгээ',
  'X-Ray': 'Рентген',
  MRI: 'MRI',
  Male: 'Эрэгтэй',
  Female: 'Эмэгтэй',
  Other: 'Бусад',
}

export function label(value: string | undefined | null): string {
  if (!value) return ''
  return LABELS[value] ?? value.replace(/_/g, ' ')
}
