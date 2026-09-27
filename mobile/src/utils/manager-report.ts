import type { Timestamp } from "firebase/firestore";
import type { AICategory } from "../types/ai-result";
import type { StaffProfile } from "../types/staff";
import type { Ticket } from "../types/ticket";
import { getSlaHours } from "./ticket-sla";

/**
 * Tính số liệu cho báo cáo quản lý (màn Tổng quan của quản trị viên) từ
 * danh sách ticket realtime. Hàm thuần, không phụ thuộc React/Firestore.
 *
 * - Thời gian phản hồi: createdAt -> respondedAt (góc nhìn khách hàng).
 * - Thời gian xử lý: claimedAt -> respondedAt (góc nhìn nhân viên). Ticket
 *   được chuyển người xử lý vẫn tính từ lúc nhận ban đầu, ghi cho người
 *   đang được giao (người đã phản hồi).
 * - Ticket xử lý trước khi có các mốc claimedAt/respondedAt không có số
 *   liệu thời gian, chỉ được đếm số lượng.
 */

export type ReportPeriod = "7d" | "30d" | "all";

export const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "all", label: "Tất cả" },
];

const PERIOD_DAYS: Record<ReportPeriod, number | null> = { "7d": 7, "30d": 30, all: null };

export const UNCLASSIFIED_CATEGORY = "Chưa phân loại";

const CATEGORY_ORDER: string[] = [
  "Gói cước/Dữ liệu",
  "SIM",
  "Đường truyền",
  "Thanh toán",
  "Khác",
  UNCLASSIFIED_CATEGORY,
];

export interface StaffReportRow {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "staff" | null;
  active: boolean;
  inProgress: number;
  done: number;
  avgHandleMs: number | null;
  avgRating: number | null;
  ratingCount: number;
}

export interface CategoryReportRow {
  category: string;
  count: number;
  highPriority: number;
  avgResponseMs: number | null;
}

export interface ManagerReport {
  total: number;
  responded: number;
  /** Số ticket đã phản hồi có đủ mốc thời gian để tính. */
  timedCount: number;
  avgResponseMs: number | null;
  avgHandleMs: number | null;
  onTimeCount: number;
  onTimeRate: number | null;
  staffRows: StaffReportRow[];
  categoryRows: CategoryReportRow[];
}

function toMillis(value: Timestamp | null): number | null {
  return value ? value.toMillis() : null;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function inPeriod(ticket: Ticket, period: ReportPeriod, now: number): boolean {
  const days = PERIOD_DAYS[period];
  if (days === null) return true;
  const createdAt = toMillis(ticket.createdAt);
  return createdAt !== null && now - createdAt <= days * 24 * 60 * 60 * 1000;
}

export function buildManagerReport(
  allTickets: Ticket[],
  categories: Record<string, AICategory>,
  staff: StaffProfile[],
  period: ReportPeriod,
  now: number = Date.now()
): ManagerReport {
  const tickets = allTickets.filter((ticket) => inPeriod(ticket, period, now));

  const responseTimes: number[] = [];
  const handleTimes: number[] = [];
  let responded = 0;
  let onTimeCount = 0;

  // Nhân viên chưa nhận ticket nào vẫn hiện trong bảng (số liệu 0).
  const staffMap = new Map<string, { row: StaffReportRow; handle: number[]; ratings: number[] }>();
  for (const member of staff) {
    staffMap.set(member.uid, {
      row: {
        uid: member.uid,
        name: member.displayName || member.email,
        email: member.email,
        role: member.role,
        active: member.active,
        inProgress: 0,
        done: 0,
        avgHandleMs: null,
        avgRating: null,
        ratingCount: 0,
      },
      handle: [],
      ratings: [],
    });
  }

  const categoryMap = new Map<string, { row: CategoryReportRow; response: number[] }>();

  for (const ticket of tickets) {
    const createdAt = toMillis(ticket.createdAt);
    const claimedAt = toMillis(ticket.claimedAt);
    const respondedAt = toMillis(ticket.respondedAt);
    const isDone = ticket.status === "responded" || ticket.status === "closed";

    let responseMs: number | null = null;
    let handleMs: number | null = null;

    if (isDone) {
      responded += 1;
      if (createdAt !== null && respondedAt !== null && respondedAt >= createdAt) {
        responseMs = respondedAt - createdAt;
        responseTimes.push(responseMs);
        if (responseMs <= getSlaHours(ticket) * 60 * 60 * 1000) onTimeCount += 1;
      }
      if (claimedAt !== null && respondedAt !== null && respondedAt >= claimedAt) {
        handleMs = respondedAt - claimedAt;
        handleTimes.push(handleMs);
      }
    }

    // Theo nhân viên
    if (ticket.assignedTo) {
      let entry = staffMap.get(ticket.assignedTo);
      if (!entry) {
        // Tài khoản không còn trong danh sách staff — vẫn giữ số liệu lịch sử.
        entry = {
          row: {
            uid: ticket.assignedTo,
            name: ticket.assignedToName ?? ticket.assignedTo,
            email: ticket.assignedToName ?? "",
            role: null,
            active: false,
            inProgress: 0,
            done: 0,
            avgHandleMs: null,
            avgRating: null,
            ratingCount: 0,
          },
          handle: [],
          ratings: [],
        };
        staffMap.set(ticket.assignedTo, entry);
      }
      if (ticket.status === "in_progress") entry.row.inProgress += 1;
      if (isDone) entry.row.done += 1;
      if (handleMs !== null) entry.handle.push(handleMs);
      if (ticket.rating) entry.ratings.push(ticket.rating);
    }

    // Theo nhóm khiếu nại (ticket chưa có kết quả AI: "Chưa phân loại")
    const category = categories[ticket.id] ?? UNCLASSIFIED_CATEGORY;
    let categoryEntry = categoryMap.get(category);
    if (!categoryEntry) {
      categoryEntry = { row: { category, count: 0, highPriority: 0, avgResponseMs: null }, response: [] };
      categoryMap.set(category, categoryEntry);
    }
    categoryEntry.row.count += 1;
    if (ticket.priority === "High Priority") categoryEntry.row.highPriority += 1;
    if (responseMs !== null) categoryEntry.response.push(responseMs);
  }

  const staffRows = [...staffMap.values()]
    .map(({ row, handle, ratings }) => ({
      ...row,
      avgHandleMs: average(handle),
      avgRating: average(ratings),
      ratingCount: ratings.length,
    }))
    .sort((a, b) => b.done + b.inProgress - (a.done + a.inProgress) || a.name.localeCompare(b.name));

  const categoryRows = [...categoryMap.values()]
    .map(({ row, response }) => ({ ...row, avgResponseMs: average(response) }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  return {
    total: tickets.length,
    responded,
    timedCount: responseTimes.length,
    avgResponseMs: average(responseTimes),
    avgHandleMs: average(handleTimes),
    onTimeCount,
    onTimeRate: responseTimes.length > 0 ? onTimeCount / responseTimes.length : null,
    staffRows,
    categoryRows,
  };
}

/** "45 phút", "3,5 giờ", "1,2 ngày" — null hiển thị "—". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = ms / 60000;
  if (minutes < 1) return "< 1 phút";
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1).replace(".", ",")} giờ`;
  return `${(hours / 24).toFixed(1).replace(".", ",")} ngày`;
}
