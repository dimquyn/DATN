import type { Firestore } from "firebase-admin/firestore";

/**
 * ============================================================
 * Giới hạn sử dụng (chống lạm dụng các chức năng công khai)
 * ============================================================
 * Website không yêu cầu đăng nhập nên bất kỳ ai cũng gửi khiếu nại, tra
 * cứu được. Hai cơ chế dưới đây chạy ở phía backend (Admin SDK), dữ liệu
 * đếm lưu trong collection "rate_limits" / "ai_usage" mà client không đọc,
 * không ghi được (firestore.rules chặn toàn bộ):
 *  1. Hạn mức phân tích AI theo ngày — toàn hệ thống và theo từng số điện
 *     thoại, để khiếu nại rác hàng loạt không làm cạn hạn mức Gemini API.
 *  2. Khóa tạm thời theo IP khi tra cứu sai quá nhiều lần — chặn việc dò
 *     mã ticket + số điện thoại của người khác.
 * ============================================================
 */

/** Tổng số lượt phân tích AI tối đa mỗi ngày cho toàn hệ thống. */
export const AI_DAILY_LIMIT = 200;
/** Số lượt phân tích AI tối đa mỗi ngày cho cùng 1 số điện thoại. */
export const AI_DAILY_LIMIT_PER_PHONE = 5;

/** Số lần tra cứu/đánh giá sai tối đa trong 1 khoảng thời gian, tính theo IP. */
export const LOOKUP_MAX_FAILURES = 10;
export const LOOKUP_WINDOW_MS = 15 * 60 * 1000;

/** Ngày hiện tại theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD — dùng làm khóa đếm theo ngày. */
export function vietnamDateKey(now: number = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Document ID trong Firestore không được chứa "/" — thay mọi ký tự lạ bằng "_". */
function safeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 200);
}

/**
 * Giữ 1 lượt phân tích AI trong hạn mức ngày. Trả về null nếu còn hạn mức
 * (đã được trừ 1 lượt), hoặc thông báo lỗi nếu đã vượt — khi đó KHÔNG gọi
 * Gemini, ticket được ghi lastAIError để nhân viên tự xử lý thủ công.
 */
export async function reserveAIQuota(
  db: Firestore,
  phone: string,
  now: number = Date.now()
): Promise<string | null> {
  const day = vietnamDateKey(now);
  const totalRef = db.collection("ai_usage").doc(day);
  const phoneRef = db.collection("ai_usage").doc(safeKey(`${day}_${phone || "unknown"}`));

  return db.runTransaction(async (transaction) => {
    const [totalSnap, phoneSnap] = await Promise.all([
      transaction.get(totalRef),
      transaction.get(phoneRef),
    ]);
    const total = (totalSnap.data()?.count as number | undefined) ?? 0;
    const perPhone = (phoneSnap.data()?.count as number | undefined) ?? 0;

    if (total >= AI_DAILY_LIMIT) {
      return `Đã vượt hạn mức phân tích AI trong ngày (${AI_DAILY_LIMIT} lượt), cần xử lý thủ công`;
    }
    if (perPhone >= AI_DAILY_LIMIT_PER_PHONE) {
      return `Số điện thoại đã vượt hạn mức phân tích AI trong ngày (${AI_DAILY_LIMIT_PER_PHONE} lượt), cần xử lý thủ công`;
    }

    transaction.set(totalRef, { count: total + 1, day }, { merge: true });
    transaction.set(phoneRef, { count: perPhone + 1, day }, { merge: true });
    return null;
  });
}

function lookupRef(db: Firestore, key: string) {
  return db.collection("rate_limits").doc(safeKey(`lookup_${key}`));
}

/** true nếu khóa (IP) này đang bị tạm khóa do tra cứu sai quá nhiều lần. */
export async function isLookupLocked(
  db: Firestore,
  key: string,
  now: number = Date.now()
): Promise<boolean> {
  const data = (await lookupRef(db, key).get()).data();
  if (!data) return false;
  const windowStart = (data.windowStart as number | undefined) ?? 0;
  const failures = (data.failures as number | undefined) ?? 0;
  return now - windowStart < LOOKUP_WINDOW_MS && failures >= LOOKUP_MAX_FAILURES;
}

/** Ghi nhận 1 lần tra cứu sai; cửa sổ đếm tự làm mới sau LOOKUP_WINDOW_MS. */
export async function recordLookupFailure(
  db: Firestore,
  key: string,
  now: number = Date.now()
): Promise<void> {
  const ref = lookupRef(db, key);
  await db.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    const windowStart = (data?.windowStart as number | undefined) ?? 0;
    const expired = !data || now - windowStart >= LOOKUP_WINDOW_MS;
    transaction.set(ref, {
      failures: expired ? 1 : ((data?.failures as number | undefined) ?? 0) + 1,
      windowStart: expired ? now : windowStart,
    });
  });
}
