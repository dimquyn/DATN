import type { ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  showError?: boolean; // mặc định false — chỉ hiện lỗi khi field đã được "chạm" vào
  extraInfo?: string; // ví dụ: đếm ký tự còn lại
  children: ReactNode;
}

// Component dùng chung: label + ô input + thông báo lỗi bên dưới.
// `id` được dùng để liên kết label <-> input (a11y: click vào label sẽ focus đúng ô input).
export default function FormField({ id, label, error, showError = false, extraInfo, children }: FormFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label htmlFor={id} className="block text-sm sm:text-base font-medium text-gray-700">
          {label}
        </label>
        {extraInfo && (
          <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap">{extraInfo}</span>
        )}
      </div>
      {children}
      {showError && error && (
        <p role="alert" className="mt-1.5 text-xs sm:text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// Hàm dùng chung để tính class viền input theo trạng thái:
// - Chưa chạm vào: viền xám mặc định
// - Đã chạm + còn lỗi: viền đỏ
// - Đã chạm + hợp lệ: viền xanh
export function getInputStateClass(showError: boolean, hasError?: string): string {
  const base =
    "w-full bg-gray-50 border rounded-lg px-3.5 py-2.5 text-sm sm:text-base text-gray-800 placeholder-gray-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:bg-white";

  if (!showError) {
    return `${base} border-gray-200 focus:ring-violet-500/40 focus:border-violet-500`;
  }
  if (hasError) {
    return `${base} border-red-400 focus:ring-red-500/30 focus:border-red-500`;
  }
  return `${base} border-green-400 focus:ring-green-500/30 focus:border-green-500`;
}