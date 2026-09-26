import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import type { ChangeEvent, FocusEvent, FormEvent } from "react";
import { trackTicket, submitTicketRating } from "../services/tracking.service";
import { validatePhone } from "../utils/validation";
import type { TrackedTicket } from "../types/ticket-tracking";

type LookupField = "code" | "phone";

// Khách hàng không đăng nhập nên firestore.rules không cho phép nghe
// onSnapshot trực tiếp trên ticket (chỉ isStaff() mới đọc được) — mô phỏng
// "thời gian thực" bằng cách tự gọi lại trackTicket định kỳ trong lúc đang
// xem kết quả, để trạng thái/phản hồi cập nhật mà khách không cần bấm gì.
const POLL_INTERVAL_MS = 5000;

// trackTicket/submitTicketRating tạm khóa theo IP khi tra cứu sai quá nhiều
// lần (functions/src/limits.ts) — hiển thị đúng thông báo của server.
function isLockedOut(err: unknown): err is FirebaseError {
  return err instanceof FirebaseError && err.code === "functions/resource-exhausted";
}

// Custom hook: toàn bộ state + logic của màn "Theo dõi trạng thái" (tra cứu
// bằng mã ticket + số điện thoại, xem phản hồi, gửi đánh giá). Tách khỏi
// TrackPage.tsx để component chỉ lo hiển thị, theo đúng pattern của
// useComplaintForm.ts.
export function useTrackTicket(initialCode?: string | null) {
  const [form, setForm] = useState({ code: initialCode ?? "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<LookupField, boolean>>>({});
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TrackedTicket | null>(null);

  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const codeError = form.code.trim().length === 0 ? "Vui lòng nhập mã khiếu nại." : undefined;
  const phoneError = validatePhone(form.phone).message;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue = name === "phone" ? value.replace(/\D/g, "") : value;
    setForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setTouched((prev) => ({ ...prev, [e.target.name as LookupField]: true }));
  };

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ code: true, phone: true });
    setLookupError(null);

    if (codeError || phoneError) return;

    setLoading(true);
    setTicket(null);

    try {
      const result = await trackTicket(form.code, form.phone);
      setTicket(result);
      setRatingValue(0);
      setRatingComment("");
      setRatingError(null);
    } catch (err) {
      setLookupError(
        isLockedOut(err)
          ? err.message
          : "Không tìm thấy khiếu nại phù hợp. Vui lòng kiểm tra lại mã và số điện thoại."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    if (ratingValue < 1) {
      setRatingError("Vui lòng chọn số sao đánh giá.");
      return;
    }

    setRatingSubmitting(true);
    setRatingError(null);

    try {
      const trimmedComment = ratingComment.trim();
      await submitTicketRating({
        code: form.code,
        phone: form.phone,
        rating: ratingValue,
        comment: trimmedComment,
      });

      // Cập nhật ngay trên state hiện có thay vì gọi lại trackTicket —
      // function chỉ trả về { success: true }, không trả ticket mới.
      setTicket((prev) =>
        prev ? { ...prev, rating: ratingValue, ratingComment: trimmedComment || null } : prev
      );
    } catch (err) {
      setRatingError(isLockedOut(err) ? err.message : "Gửi đánh giá thất bại. Vui lòng thử lại.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const resetLookup = () => {
    setTicket(null);
    setLookupError(null);
  };

  // Chỉ chạy khi đã tìm thấy ticket (đang ở màn kết quả) — dừng hẳn khi
  // resetLookup (quay về form) hoặc khi component unmount, tránh gọi lãng
  // phí lúc khách chưa tra cứu hoặc đã rời trang.
  useEffect(() => {
    if (!ticket) return;

    const intervalId = window.setInterval(async () => {
      try {
        const result = await trackTicket(form.code, form.phone);
        setTicket(result);
      } catch {
        // Bỏ qua lỗi tạm thời (mất mạng 1 nhịp...) — giữ nguyên dữ liệu cũ,
        // lần poll kế tiếp tự thử lại, không cần làm phiền khách bằng lỗi.
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [ticket?.code, form.code, form.phone]);

  return {
    form,
    touched,
    codeError,
    phoneError,
    lookupError,
    loading,
    ticket,
    ratingValue,
    setRatingValue,
    ratingComment,
    setRatingComment,
    ratingSubmitting,
    ratingError,
    handleChange,
    handleBlur,
    handleLookup,
    handleSubmitRating,
    resetLookup,
  };
}
