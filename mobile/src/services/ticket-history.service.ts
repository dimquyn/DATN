import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TicketHistoryEntry } from "../types/ticket-history";

function mapHistoryData(id: string, data: DocumentData): TicketHistoryEntry {
  return {
    id,
    ticketId: data.ticketId,
    ticketCode: data.ticketCode ?? null,
    action: data.action,
    actorName: data.actorName,
    createdAt: data.createdAt ?? null,
  };
}

export interface AddTicketHistoryEntryOptions {
  ticketCode?: string | null;
  actorName: string;
  action: string;
}

/** Ghi 1 dòng lịch sử cho ticket — dùng mỗi khi trạng thái ticket thay đổi từ app. */
export async function addTicketHistoryEntry(
  ticketId: string,
  options: AddTicketHistoryEntryOptions
): Promise<void> {
  await addDoc(collection(db, "tickets", ticketId, "history"), {
    ticketId,
    ticketCode: options.ticketCode ?? null,
    action: options.action,
    actorName: options.actorName,
    createdAt: serverTimestamp(),
  });
}

/** Lắng nghe lịch sử của 1 ticket cụ thể — dùng cho màn "Lịch sử xử lý". */
export function subscribeToTicketHistory(
  ticketId: string,
  onData: (entries: TicketHistoryEntry[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const historyQuery = query(
    collection(db, "tickets", ticketId, "history"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    historyQuery,
    (snapshot) => {
      onData(snapshot.docs.map((docSnap) => mapHistoryData(docSnap.id, docSnap.data())));
    },
    onError
  );
}
