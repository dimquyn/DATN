import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
  type WriteBatch,
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
  /** UID người thực hiện — firestore.rules yêu cầu trùng với tài khoản đang đăng nhập. */
  actorUid: string;
  action: string;
}

/**
 * Thêm 1 dòng lịch sử vào CÙNG batch với thao tác cập nhật ticket — rules
 * chỉ chấp nhận dòng lịch sử của nhân viên khi ticket được cập nhật trong
 * cùng request, nên 2 thao tác luôn thành công hoặc thất bại cùng nhau.
 */
export function addTicketHistoryEntryToBatch(
  batch: WriteBatch,
  ticketId: string,
  options: AddTicketHistoryEntryOptions
): void {
  batch.set(doc(collection(db, "tickets", ticketId, "history")), {
    ticketId,
    ticketCode: options.ticketCode ?? null,
    action: options.action,
    actorName: options.actorName,
    actorUid: options.actorUid,
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
