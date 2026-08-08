import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Ticket } from "../types/ticket";

const TICKETS_COLLECTION = "tickets";

function mapTicketData(id: string, data: DocumentData): Ticket {
  return {
    id,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email,
    content: data.content,
    channel: data.channel,
    status: data.status,
    assignedTo: data.assignedTo ?? null,
    aiResultId: data.aiResultId ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastAIError: data.lastAIError,
  };
}

export function subscribeToTickets(
  onData: (tickets: Ticket[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const ticketsQuery = query(
    collection(db, TICKETS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    ticketsQuery,
    (snapshot) => {
      onData(snapshot.docs.map((docSnap) => mapTicketData(docSnap.id, docSnap.data())));
    },
    onError
  );
}

/**
 * Đọc 1 ticket theo document ID — dùng cho màn Ticket Detail (Sprint 3).
 * Trả null nếu ticket không tồn tại. Không chứa UI logic.
 */
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);
  const snapshot = await getDoc(ticketRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapTicketData(snapshot.id, snapshot.data());
}