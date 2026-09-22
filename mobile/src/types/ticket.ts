import type { Timestamp } from "firebase/firestore";

export type TicketChannel = "Website" | "Facebook" | "Zalo";

export type TicketStatus =
  | "pending"
  | "ai_analyzed"
  | "in_progress"
  | "responded"
  | "closed";

export interface Ticket {
  id: string;
  code: string | null;
  customerName: string;
  phone: string;
  email: string;
  content: string;
  channel: TicketChannel;
  status: TicketStatus;
  assignedTo: string | null;
  /** Email nhân viên đã nhận xử lý — lưu kèm lúc nhận xử lý để hiển thị
   *  thay vì UID thô (client không tra được tên từ UID qua Auth). */
  assignedToName: string | null;
  aiResultId: string | null;
  priority: "High Priority" | "Medium" | "Low" | null;
  finalReply: string | null;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastAIError?: string;
}