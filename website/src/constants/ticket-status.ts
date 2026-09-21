import type { TicketTrackStatus } from "../types/ticket-tracking";

export const TICKET_STATUS_LABELS: Record<TicketTrackStatus, string> = {
  pending: "Đã tiếp nhận",
  ai_analyzed: "Đã tiếp nhận",
  in_progress: "Đang xử lý",
  responded: "Đã phản hồi",
  closed: "Đã hoàn tất",
};

// Với khách hàng, "pending" và "ai_analyzed" không khác biệt về trải nghiệm
// (đều là "đã gửi, chưa ai xử lý") nên gộp chung 1 bước hiển thị.
export const TICKET_TRACK_STEPS = ["Đã gửi", "Đang xử lý", "Đã phản hồi", "Hoàn tất"] as const;

export function getTicketStepIndex(status: TicketTrackStatus): number {
  switch (status) {
    case "pending":
    case "ai_analyzed":
      return 0;
    case "in_progress":
      return 1;
    case "responded":
      return 2;
    case "closed":
      return 3;
    default:
      return 0;
  }
}
