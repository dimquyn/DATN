import type { Ticket } from "../types/ticket";

/**
 * Mã ticket hiển thị: ưu tiên field `code` (dạng "TK01", sinh tuần tự lúc
 * tạo ticket trên web). Ticket tạo trước khi có field này thì fallback về
 * mã suy ra từ document ID để vẫn hiển thị được.
 */
export function getDisplayTicketCode(ticket: Pick<Ticket, "id" | "code">): string {
  if (ticket.code) return ticket.code;
  return `#TK-${ticket.id.slice(-6).toUpperCase()}`;
}
