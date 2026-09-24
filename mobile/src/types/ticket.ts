import type { Timestamp } from "firebase/firestore";

export type TicketChannel = "Website" | "Facebook" | "Zalo";

// Hình thức nhân viên đã liên hệ để gửi phản hồi cho khách — mô phỏng theo
// đúng phạm vi đồ án (không gửi thật qua điện thoại/tin nhắn/email), chỉ ghi
// nhận lại lựa chọn của nhân viên vào cơ sở dữ liệu.
export type ContactMethod = "phone" | "message" | "email";

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
  contactMethod: ContactMethod | null;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastAIError?: string;
}