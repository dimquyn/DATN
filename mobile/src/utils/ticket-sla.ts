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

/** Ticket đã đóng thì không còn tính quá hạn nữa. */
export function isTicketOverdue(ticket: Ticket): boolean {
  if (ticket.status === "closed") return false;

  const createdAt = toDate(ticket.createdAt);
  if (!createdAt) return false;

  const slaHours = ticket.priority ? SLA_HOURS[ticket.priority] : SLA_HOURS.default;
  const deadline = createdAt.getTime() + slaHours * 60 * 60 * 1000;

  return Date.now() > deadline;
}
