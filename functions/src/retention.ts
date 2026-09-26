import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

/**
 * ============================================================
 * Ẩn danh dữ liệu cá nhân của khiếu nại cũ
 * ============================================================
 * Ticket đã đóng quá RETENTION_DAYS ngày được xóa các thông tin định danh
 * khách hàng (họ tên, số điện thoại, email), chỉ giữ lại nội dung và kết
 * quả xử lý phục vụ thống kê — hạn chế lưu trữ dữ liệu cá nhân lâu hơn mức
 * cần thiết (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân). Sau khi ẩn
 * danh, khách hàng không còn tra cứu được ticket bằng số điện thoại.
 * ============================================================
 */
export const RETENTION_DAYS = 365;

export const ANONYMIZED_NAME = "Khách hàng (đã ẩn danh)";

/** Ẩn danh các ticket đã đóng, cập nhật lần cuối trước mốc thời gian cho phép. Trả về số ticket đã xử lý. */
export async function anonymizeClosedTickets(
  db: Firestore,
  retentionDays: number = RETENTION_DAYS,
  now: number = Date.now()
): Promise<number> {
  const cutoff = Timestamp.fromMillis(now - retentionDays * 24 * 60 * 60 * 1000);

  // Chỉ lọc theo 1 trường (updatedAt) để dùng index mặc định; điều kiện
  // status == "closed" và chưa ẩn danh được kiểm tra tiếp ở dưới.
  const snapshot = await db.collection("tickets").where("updatedAt", "<", cutoff).get();

  const targets = snapshot.docs.filter(
    (docSnap) => docSnap.data().status === "closed" && !docSnap.data().anonymizedAt
  );

  // Mỗi batch tối đa 500 thao tác — mỗi ticket dùng 2 (cập nhật + lịch sử).
  for (let i = 0; i < targets.length; i += 200) {
    const batch = db.batch();
    for (const docSnap of targets.slice(i, i + 200)) {
      batch.update(docSnap.ref, {
        customerName: ANONYMIZED_NAME,
        phone: "",
        email: "",
        anonymizedAt: FieldValue.serverTimestamp(),
      });
      batch.set(docSnap.ref.collection("history").doc(), {
        ticketId: docSnap.id,
        ticketCode: docSnap.data().code ?? null,
        action: "anonymized",
        actorName: "Hệ thống",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return targets.length;
}
