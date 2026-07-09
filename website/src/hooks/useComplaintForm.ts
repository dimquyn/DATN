import { useState } from "react";
import type { ChangeEvent, FocusEvent, FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { TICKET_CHANNELS } from "../types/ticket";
import type { Ticket } from "../types/ticket";
import { validateName, validatePhone, validateEmail, validateContent } from "../utils/validation";

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

      await addDoc(collection(db, "tickets"), newTicket);

      setSubmitted(true);
      setForm(EMPTY_FORM);
      setErrors({});
      setTouched({});
    } catch (err) {
      console.error(err);
      setSubmitError("Gửi khiếu nại thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
  };

  return {
    form,
    errors,
    touched,
    submitting,
    submitted,
    submitError,
    channelOptions: TICKET_CHANNELS,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  };
}