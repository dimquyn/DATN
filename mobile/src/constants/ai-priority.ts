import type { AIPriority } from "../types/ai-result";

export const AI_PRIORITY_LABELS: Record<AIPriority, string> = {
  "High Priority": "Cao",
  Medium: "Trung bình",
  Low: "Thấp",
};

export const AI_PRIORITY_STYLES: Record<
  AIPriority,
  { bg: string; border: string; text: string }
> = {
  "High Priority": { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  Medium: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  Low: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
};