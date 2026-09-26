import type { Timestamp } from "firebase/firestore";

export type TicketHistoryAction =
  | "created"
  | "ai_analyzed"
  | "claimed"
  | "reassigned"
  | "responded"
  | "closed"
  | "rated";

export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  ticketCode: string | null;
  action: TicketHistoryAction | string;
  actorName: string;
  createdAt: Timestamp | null;
}
