import { useState } from "react";
import type { ChangeEvent, FocusEvent, FormEvent } from "react";
import { trackTicket, submitTicketRating } from "../services/tracking.service";
import { validatePhone } from "../utils/validation";
import type { TrackedTicket } from "../types/ticket-tracking";

type LookupField = "code" | "phone";

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
    } catch {
      setLookupError("Không tìm thấy khiếu nại phù hợp. Vui lòng kiểm tra lại mã và số điện thoại.");
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
    } catch {
      setRatingError("Gửi đánh giá thất bại. Vui lòng thử lại.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const resetLookup = () => {
    setTicket(null);
    setLookupError(null);
  };

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
