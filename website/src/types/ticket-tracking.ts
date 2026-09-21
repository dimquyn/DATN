export type TicketTrackStatus = "pending" | "ai_analyzed" | "in_progress" | "responded" | "closed";

// Dữ liệu tối thiểu trả về từ Cloud Function trackTicket — KHÔNG chứa thông
// tin nội bộ (assignedTo, aiResultId, lastAIError...), chỉ đủ để khách hàng
// theo dõi trạng thái và đánh giá.
export interface TrackedTicket {
  code: string;
  status: TicketTrackStatus;
  createdAt: number | null;
  updatedAt: number | null;
  finalReply: string | null;
  rating: number | null;
  ratingComment: string | null;
}
