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

export interface TicketStatusAction {
  nextStatus: TicketStatus;
  label: string;
}

/**
 * Hành động "chung" kế tiếp cho 1 trạng thái ticket (Sprint 4).
 * Bước in_progress -> responded KHÔNG nằm ở đây vì nó gắn liền với việc
 * xác nhận nội dung phản hồi (finalReply), được xử lý riêng trong
 * Ticket Detail cùng với ô nhập phản hồi.
 */
export function getNextTicketAction(status: TicketStatus): TicketStatusAction | null {
  switch (status) {
    case "ai_analyzed":
      return { nextStatus: "in_progress", label: "Nhận xử lý" };
    case "responded":
      return { nextStatus: "closed", label: "Đóng khiếu nại" };
    default:
      return null;
  }
}