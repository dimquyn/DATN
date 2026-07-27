import { signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
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