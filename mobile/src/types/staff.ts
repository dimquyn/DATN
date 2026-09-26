import type { Timestamp } from "firebase/firestore";

export type StaffRole = "admin" | "staff";

/** Hồ sơ phân quyền nhân viên — collection "staff/{uid}". */
export interface StaffProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: Timestamp | null;
}
