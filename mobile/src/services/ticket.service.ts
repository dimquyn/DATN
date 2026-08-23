import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Ticket, TicketStatus } from "../types/ticket";

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
    finalReply: data.finalReply ?? null,
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

export interface UpdateTicketStatusOptions {
  /** Chỉ truyền khi nhân viên "Nhận xử lý" (ai_analyzed -> in_progress). */
  assignedTo?: string;
  /**
   * Nội dung phản hồi thực tế đã gửi khách hàng, ghi vào tickets.finalReply
   * khi xác nhận đã phản hồi (in_progress -> responded).
   * KHÔNG liên quan và KHÔNG ghi đè ai_results.reply.
   */
  finalReply?: string;
}

/**
 * Cập nhật trạng thái ticket trên Firestore (Sprint 4).
 * Luôn ghi updatedAt bằng serverTimestamp(). assignedTo/finalReply chỉ được
 * ghi khi được truyền vào, tương ứng đúng bước chuyển trạng thái gọi hàm này.
 * Không tự validate transition ở đây — UI (Ticket Detail) chịu trách nhiệm
 * chỉ cho phép gọi đúng bước hợp lệ theo trạng thái hiện tại.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  options?: UpdateTicketStatusOptions
): Promise<void> {
  const ticketRef = doc(db, TICKETS_COLLECTION, ticketId);

  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (options?.assignedTo) {
    updates.assignedTo = options.assignedTo;
  }

  if (options?.finalReply !== undefined) {
    updates.finalReply = options.finalReply;
  }

  await updateDoc(ticketRef, updates);
}