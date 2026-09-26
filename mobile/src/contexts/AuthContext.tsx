import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { loginWithEmail, logoutUser } from "../services/auth.service";
import { subscribeToStaffProfile } from "../services/staff.service";
import type { AuthContextValue } from "../types/auth";
import type { StaffProfile } from "../types/staff";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NO_ACCESS_MESSAGE =
  "Tài khoản chưa được cấp quyền truy cập hệ thống. Vui lòng liên hệ quản trị viên.";
const DISABLED_MESSAGE = "Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên.";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [profileResolved, setProfileResolved] = useState<boolean>(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setFirebaseUser(nextUser);
        setAuthResolved(true);
      },
      () => {
        setFirebaseUser(null);
        setAuthResolved(true);
      }
    );

    return unsubscribe;
  }, []);

  // Đăng nhập Firebase Auth thành công chưa đủ: phải có hồ sơ staff/{uid}
  // đang hoạt động mới được vào app. Lắng nghe realtime nên khi admin khóa
  // tài khoản, nhân viên đang mở app bị đăng xuất ngay lập tức.
  useEffect(() => {
    setProfile(null);
    setProfileResolved(false);

    if (!firebaseUser) return;

    const unsubscribe = subscribeToStaffProfile(
      firebaseUser.uid,
      (nextProfile) => {
        if (!nextProfile || !nextProfile.active) {
          setAccessError(nextProfile ? DISABLED_MESSAGE : NO_ACCESS_MESSAGE);
          setProfile(null);
          void logoutUser();
          return;
        }

        setProfile(nextProfile);
        setProfileResolved(true);
      },
      (err) => {
        console.error("Lỗi khi tải hồ sơ phân quyền:", err);
        setAccessError(NO_ACCESS_MESSAGE);
        setProfile(null);
        void logoutUser();
      }
    );

    return unsubscribe;
  }, [firebaseUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      setAccessError(null);
      await loginWithEmail(email, password);
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await logoutUser();
  }, []);

  const clearAccessError = useCallback(() => setAccessError(null), []);

  // Chỉ "mở" user cho các màn hình khi đã xác nhận là nhân viên đang hoạt
  // động — mọi màn đang kiểm tra `user` sẵn sẽ tự chuyển về đăng nhập.
  const user = firebaseUser && profile?.active ? firebaseUser : null;
  const initializing = !authResolved || (!!firebaseUser && !profileResolved);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile: user ? profile : null,
      isAdmin: !!user && profile?.role === "admin",
      initializing,
      accessError,
      clearAccessError,
      login,
      logout,
    }),
    [user, profile, initializing, accessError, clearAccessError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  }

  return context;
}
