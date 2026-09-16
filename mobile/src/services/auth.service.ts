import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth } from "../firebase";

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Đổi mật khẩu cho tài khoản đang đăng nhập — xác thực lại bằng mật khẩu
 * hiện tại trước (Firebase yêu cầu phiên đăng nhập "mới" để đổi mật khẩu).
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;

  if (!user || !user.email) {
    throw new Error("Không xác định được tài khoản đang đăng nhập.");
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}