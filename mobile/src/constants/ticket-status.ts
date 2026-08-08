import type { TicketStatus } from "../types/ticket";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Chờ xử lý",
  ai_analyzed: "AI đã phân tích",
  in_progress: "Đang xử lý",
  responded: "Đã phản hồi",
  closed: "Đã đóng",
};

export function getTicketStatusLabel(status?: string | null): string {
  if (status && status in TICKET_STATUS_LABELS) {
    return TICKET_STATUS_LABELS[status as TicketStatus];
  }
  return "Không xác định";
}