import type { User } from "firebase/auth";
import type { StaffProfile } from "./staff";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue {
  /** Chỉ khác null khi đã đăng nhập VÀ là nhân viên đang hoạt động (có staff/{uid}, active). */
  user: User | null;
  /** Hồ sơ phân quyền (vai trò, trạng thái) của nhân viên đang đăng nhập. */
  profile: StaffProfile | null;
  isAdmin: boolean;
  initializing: boolean;
  /** Lý do bị đăng xuất tự động (không có quyền / bị khóa) — hiển thị ở màn đăng nhập. */
  accessError: string | null;
  clearAccessError: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
