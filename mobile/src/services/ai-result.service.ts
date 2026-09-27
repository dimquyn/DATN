import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AICategory, AIResult } from "../types/ai-result";

const AI_RESULTS_COLLECTION = "ai_results";

/**
 * Đọc 1 kết quả AI theo document ID (aiResultId trên ticket).
 * KHÔNG query toàn bộ collection, KHÔNG query theo ticketId —
 * aiResultId là lookup chính theo đúng yêu cầu Sprint 3.
 */
export async function getAIResultById(aiResultId: string): Promise<AIResult | null> {
  const ref = doc(db, AI_RESULTS_COLLECTION, aiResultId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    id: snapshot.id,
    ticketId: data.ticketId,
    category: data.category,
    priority: data.priority,
    sentiment: data.sentiment,
    summary: data.summary,
    suggestion: data.suggestion,
    reply: data.reply,
    analyzedAt: data.analyzedAt ?? null,
  };
}
/**
 * Lắng nghe nhóm khiếu nại (category) của mọi kết quả AI, trả về map
 * ticketId -> category — dùng cho báo cáo quản lý ở màn Tổng quan (admin),
 * vì category chỉ lưu trong ai_results, không lưu trên ticket.
 */
export function subscribeToAICategories(
  onData: (categories: Record<string, AICategory>) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, AI_RESULTS_COLLECTION),
    (snapshot) => {
      const categories: Record<string, AICategory> = {};
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.ticketId && data.category) categories[data.ticketId] = data.category;
      }
      onData(categories);
    },
    onError
  );
}
