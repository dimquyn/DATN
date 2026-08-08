import type { Timestamp } from "firebase/firestore";

export type AICategory =
  | "Gói cước/Dữ liệu"
  | "SIM"
  | "Đường truyền"
  | "Thanh toán"
  | "Khác";

export type AIPriority = "High Priority" | "Medium" | "Low";

export type AISentiment = "Tích cực" | "Trung lập" | "Tiêu cực" | "Rất tiêu cực";

export interface AIResult {
  id: string;
  ticketId: string;
  category: AICategory;
  priority: AIPriority;
  sentiment: AISentiment;
  summary: string;
  suggestion: string;
  reply: string;
  analyzedAt: Timestamp | null;
}