// Các hàm validate thuần túy, không phụ thuộc React
// -> có thể tái sử dụng ở Mobile app hoặc Cloud Functions sau này

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// Hằng số giới hạn — dùng chung cho cả validate logic (ở đây)
// lẫn thuộc tính maxLength trên input (bên ComplaintPage.tsx)
export const NAME_MAX_LENGTH = 100;
export const PHONE_LENGTH = 10;
export const EMAIL_MAX_LENGTH = 100;
export const CONTENT_MIN_LENGTH = 20;
export const CONTENT_MAX_LENGTH = 1000;

// Đầu số di động hợp lệ tại Việt Nam: 03, 05, 07, 08, 09
const PHONE_REGEX = /^0(3|5|7|8|9)[0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value: string): ValidationResult {
  if (value.trim().length === 0) {
    return { valid: false, message: "Vui lòng nhập họ tên." };
  }
  if (value.length > NAME_MAX_LENGTH) {
    return { valid: false, message: `Họ tên không được vượt quá ${NAME_MAX_LENGTH} ký tự.` };
  }
  return { valid: true };
}

export function validatePhone(value: string): ValidationResult {
  if (value.length === 0) {
    return { valid: false, message: "Vui lòng nhập số điện thoại." };
  }
  if (value.length !== PHONE_LENGTH) {
    return { valid: false, message: `Số điện thoại phải gồm đúng ${PHONE_LENGTH} chữ số.` };
  }
  if (!PHONE_REGEX.test(value)) {
    return { valid: false, message: "Số điện thoại không đúng định dạng Việt Nam." };
  }
  return { valid: true };
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: "Vui lòng nhập email." };
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return { valid: false, message: `Email không được vượt quá ${EMAIL_MAX_LENGTH} ký tự.` };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: "Email không đúng định dạng." };
  }
  return { valid: true };
}

export function validateContent(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length < CONTENT_MIN_LENGTH) {
    return {
      valid: false,
      message: `Nội dung cần tối thiểu ${CONTENT_MIN_LENGTH} ký tự (hiện tại ${trimmed.length}).`,
    };
  }
  if (value.length > CONTENT_MAX_LENGTH) {
    return { valid: false, message: `Nội dung không được vượt quá ${CONTENT_MAX_LENGTH} ký tự.` };
  }
  return { valid: true };
}