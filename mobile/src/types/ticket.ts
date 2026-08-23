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
  customerName: string;
  phone: string;
  email: string;
  content: string;
  channel: TicketChannel;
  status: TicketStatus;
  assignedTo: string | null;
  aiResultId: string | null;
  finalReply: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastAIError?: string;
}