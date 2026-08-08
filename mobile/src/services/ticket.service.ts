import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Ticket } from "../types/ticket";

const TICKETS_COLLECTION = "tickets";

function mapDocToTicket(doc: QueryDocumentSnapshot<DocumentData>): Ticket {
  const data = doc.data();

  return {
    id: doc.id,
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
      onData(snapshot.docs.map(mapDocToTicket));
    },
    onError
  );
}