import type { Timestamp } from "firebase/firestore";

export type TicketChannel = "Website" | "Facebook" | "Zalo" | "Email";

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
  /** Mốc thời gian các bước xử lý — dùng cho báo cáo quản lý (thời gian
   *  xử lý trung bình). Ticket xử lý trước khi có các trường này là null. */
  claimedAt: Timestamp | null;
  respondedAt: Timestamp | null;
  closedAt: Timestamp | null;
  /** Nhân viên đã "Chuyển cho quản trị viên" — ticket vào hàng chờ của admin
   *  (assignedTo = null) cho tới khi 1 quản trị viên nhận xử lý. */
  escalated: boolean;
  escalatedBy: string | null;
  escalatedByName: string | null;
  escalationNote: string | null;
  escalatedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastAIError?: string;
}