import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { AIResult } from "../types/ai-result";

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