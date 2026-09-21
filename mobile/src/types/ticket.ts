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