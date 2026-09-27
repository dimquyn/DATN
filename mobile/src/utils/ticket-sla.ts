import type { Timestamp } from "firebase/firestore";
import type { Ticket } from "../types/ticket";
import type { AIPriority } from "../types/ai-result";

// Hạn xử lý (SLA) tính bằng giờ kể từ lúc tạo ticket, theo mức độ ưu tiên AI.
// Ticket chưa được AI phân tích (priority == null) dùng mốc mặc định.
const SLA_HOURS: Record<AIPriority | "default", number> = {
  "High Priority": 2,
  Medium: 8,
  Low: 24,
  default: 4,
};

function toDate(value: Timestamp | null): Date | null {
  if (!value) return null;
  return value.toDate();
}

/** Hạn xử lý (giờ) của ticket theo mức độ ưu tiên AI. */
export function getSlaHours(ticket: Ticket): number {
  return ticket.priority ? SLA_HOURS[ticket.priority] : SLA_HOURS.default;
}

/** Ticket đã đóng thì không còn tính quá hạn nữa. */
export function isTicketOverdue(ticket: Ticket): boolean {
  if (ticket.status === "closed") return false;

  const createdAt = toDate(ticket.createdAt);
  if (!createdAt) return false;

  const deadline = createdAt.getTime() + getSlaHours(ticket) * 60 * 60 * 1000;

  return Date.now() > deadline;
}
