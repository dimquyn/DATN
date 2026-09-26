import type { TicketHistoryAction } from "../types/ticket-history";

export const TICKET_HISTORY_LABELS: Record<TicketHistoryAction, string> = {
  created: "Ticket được tạo",
  ai_analyzed: "AI phân tích hoàn tất",
  claimed: "Nhân viên tiếp nhận",
  reassigned: "Quản trị viên chuyển người xử lý",
  responded: "Đã gửi phản hồi khách hàng",
  closed: "Ticket đóng",
  rated: "Khách hàng đánh giá",
  anonymized: "Ẩn danh dữ liệu khách hàng",
};

export function getTicketHistoryLabel(action: string): string {
  if (action in TICKET_HISTORY_LABELS) {
    return TICKET_HISTORY_LABELS[action as TicketHistoryAction];
  }
  return action;
}

export const TICKET_HISTORY_DOT_COLORS: Record<TicketHistoryAction, string> = {
  created: "#9CA3AF",
  ai_analyzed: "#3B82F6",
  claimed: "#F97316",
  reassigned: "#8B5CF6",
  responded: "#F97316",
  closed: "#10B981",
  rated: "#EAB308",
  anonymized: "#6B7280",
};

export function getTicketHistoryDotColor(action: string): string {
  if (action in TICKET_HISTORY_DOT_COLORS) {
    return TICKET_HISTORY_DOT_COLORS[action as TicketHistoryAction];
  }
  return "#9CA3AF";
}
