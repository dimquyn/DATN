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
import type { AuthContextValue } from "../types/auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setInitializing(false);
      },
      () => {
        setUser(null);
        setInitializing(false);
      }
    );

    return unsubscribe;
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      await loginWithEmail(email, password);
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await logoutUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout]
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