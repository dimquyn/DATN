// Danh sách kênh gửi là NGUỒN DUY NHẤT — TicketChannel được suy ra từ đây,
// tránh phải khai báo type và mảng giá trị ở 2 nơi khác nhau.
export const TICKET_CHANNELS = ["Website", "Facebook", "Zalo", "Email"] as const;

export type TicketChannel = (typeof TICKET_CHANNELS)[number];

export interface Ticket {
  code: string;
  customerName: string;
  phone: string;
  email: string;
  content: string;
  channel: TicketChannel;
  status: "pending" | "ai_analyzed" | "in_progress" | "responded" | "closed";
  assignedTo: string | null;
  aiResultId: string | null;
  createdAt: number;
  updatedAt: number;
}