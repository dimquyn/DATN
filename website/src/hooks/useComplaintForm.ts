import { useState } from "react";
import type { ChangeEvent, FocusEvent, FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { TICKET_CHANNELS } from "../types/ticket";
import { validateName, validatePhone, validateEmail, validateContent } from "../utils/validation";

// Đếm số ticket đã tạo để sinh mã tuần tự (TK01, TK02, ...). Dùng transaction
// để tăng bộ đếm và tạo ticket cùng lúc, tránh 2 khách gửi đồng thời bị trùng mã.
const TICKETS_COUNTER_REF = doc(db, "counters", "tickets");

async function createTicketWithCode(
  ticketData: Record<string, unknown>
): Promise<string> {
  const ticketRef = doc(collection(db, "tickets"));
  const historyRef = doc(collection(ticketRef, "history"));

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(TICKETS_COUNTER_REF);
    const nextNumber = (counterSnap.exists() ? (counterSnap.data().count as number) : 0) + 1;
    const code = `TK${String(nextNumber).padStart(2, "0")}`;

    // lastTicketId + phone_cooldowns: firestore.rules chỉ cho tăng bộ đếm
    // khi có ticket được tạo kèm trong cùng transaction, và mỗi số điện
    // thoại phải chờ 30 giây giữa 2 lần gửi (chống gửi khiếu nại hàng loạt).
    transaction.set(TICKETS_COUNTER_REF, { count: nextNumber, lastTicketId: ticketRef.id });
    transaction.set(doc(db, "phone_cooldowns", String(ticketData.phone)), {
      lastAt: serverTimestamp(),
      ticketId: ticketRef.id,
    });
    transaction.set(ticketRef, { ...ticketData, code });
    transaction.set(historyRef, {
      ticketId: ticketRef.id,
      ticketCode: code,
      action: "created",
      actorName: "Hệ thống",
      createdAt: serverTimestamp(),
    });

    return code;
  });
}

const EMPTY_FORM = {
  customerName: "",
  phone: "",
  email: "",
  content: "",
  channel: TICKET_CHANNELS[0], // "Website" — kênh mặc định vì đây là form trên web
};

type FieldName = keyof typeof EMPTY_FORM;
// Các field cần validate — không bao gồm "channel" (luôn hợp lệ vì là dropdown)
type ValidatableField = Exclude<FieldName, "channel">;

type FormErrors = Partial<Record<ValidatableField, string>>;

// Bảng tra cứu hàm validate theo tên field — thay cho switch/case.
// Ưu điểm: thêm field mới chỉ cần thêm 1 dòng ở đây, không phải sửa nhiều nơi.
const validators: Record<ValidatableField, (value: string) => string | undefined> = {
  customerName: (v) => validateName(v).message,
  phone: (v) => validatePhone(v).message,
  email: (v) => validateEmail(v).message,
  content: (v) => validateContent(v).message,
};

function isValidatableField(name: string): name is ValidatableField {
  return name in validators;
}

// Custom hook: chứa toàn bộ state và logic của form gửi khiếu nại.
// Tách riêng khỏi component để ComplaintPage.tsx chỉ lo phần hiển thị.
export function useComplaintForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    // Số điện thoại: tự động loại bỏ ký tự không phải số ngay khi gõ
    const nextValue = name === "phone" ? value.replace(/\D/g, "") : value;

    setForm((prev) => ({ ...prev, [name]: nextValue }));

    // Báo lỗi ngay khi nhập, chỉ áp dụng cho field đã từng chạm vào (blur 1 lần)
    if (touched[name as FieldName] && isValidatableField(name)) {
      setErrors((prev) => ({ ...prev, [name]: validators[name](nextValue) }));
    }
  };

  const handleBlur = (
    e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (isValidatableField(name)) {
      setErrors((prev) => ({ ...prev, [name]: validators[name](value) }));
    }
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {
      customerName: validators.customerName(form.customerName),
      phone: validators.phone(form.phone),
      email: validators.email(form.email),
      content: validators.content(form.content),
    };
    setErrors(newErrors);
    setTouched({ customerName: true, phone: true, email: true, content: true });
    return Object.values(newErrors).every((msg) => !msg);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateAll()) return;

    setSubmitting(true);
    try {
      const newTicket = {
         customerName: form.customerName.trim(),
         phone: form.phone,
         email: form.email.trim(),
         content: form.content.trim(),
         channel: form.channel,
         status: "pending",
         assignedTo: null,
         aiResultId: null,
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp(),
      };

      const code = await createTicketWithCode(newTicket);

      setSubmittedCode(code);
      setSubmitted(true);
      setForm(EMPTY_FORM);
      setErrors({});
      setTouched({});
    } catch (err) {
      console.error(err);
      // Dữ liệu đã qua validate ở trên nên permission-denied gần như chắc
      // chắn là do số điện thoại vừa gửi khiếu nại chưa quá 30 giây.
      setSubmitError(
        err instanceof FirebaseError && err.code === "permission-denied"
          ? "Số điện thoại này vừa gửi khiếu nại. Vui lòng chờ 30 giây rồi thử lại."
          : "Gửi khiếu nại thất bại. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setSubmittedCode(null);
  };

  return {
    form,
    errors,
    touched,
    submitting,
    submitted,
    submitError,
    submittedCode,
    channelOptions: TICKET_CHANNELS,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  };
}