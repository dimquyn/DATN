import type { Timestamp } from "firebase/firestore";

function hasToDate(value: unknown): value is Timestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  );
}

export function formatTicketDate(value: Timestamp | Date | null | undefined): string {
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (hasToDate(value)) {
    date = value.toDate();
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "Không xác định";
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Format dạng tương đối: "X phút trước", "X giờ trước", "Hôm qua", "X ngày trước".
 * Dùng cho TicketCard theo mockup mới. Fallback "Không xác định" nếu thiếu dữ liệu.
 */
export function formatRelativeTicketTime(
  value: Timestamp | Date | null | undefined
): string {
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (hasToDate(value)) {
    date = value.toDate();
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "Không xác định";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "Vừa xong";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  if (diffDays === 1) {
    return "Hôm qua";
  }
  if (diffDays < 30) {
    return `${diffDays} ngày trước`;
  }

  return formatTicketDate(date);
}