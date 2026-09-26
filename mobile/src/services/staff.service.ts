import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { StaffProfile, StaffRole } from "../types/staff";

const STAFF_COLLECTION = "staff";

function mapStaffData(uid: string, data: DocumentData): StaffProfile {
  return {
    uid,
    email: data.email ?? "",
    displayName: data.displayName ?? null,
    role: data.role === "admin" ? "admin" : "staff",
    active: data.active === true,
    createdAt: data.createdAt ?? null,
  };
}

/**
 * Lắng nghe hồ sơ phân quyền của 1 nhân viên. Trả null nếu tài khoản chưa
 * được cấp quyền (không có document staff/{uid}). Dùng realtime để khi admin
 * khóa tài khoản, app của nhân viên đó tự đăng xuất ngay.
 */
export function subscribeToStaffProfile(
  uid: string,
  onData: (profile: StaffProfile | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, STAFF_COLLECTION, uid),
    (snapshot) => onData(snapshot.exists() ? mapStaffData(snapshot.id, snapshot.data()) : null),
    onError
  );
}

/** Danh sách toàn bộ nhân viên — chỉ admin đọc được (firestore.rules). */
export function subscribeToStaffList(
  onData: (staff: StaffProfile[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, STAFF_COLLECTION),
    (snapshot) => {
      const staff = snapshot.docs.map((docSnap) => mapStaffData(docSnap.id, docSnap.data()));
      // Admin lên trước, sau đó theo email — sắp xếp phía client vì document
      // tạo bằng script khởi tạo có thể thiếu createdAt (orderBy sẽ bỏ sót).
      staff.sort((a, b) =>
        a.role === b.role ? a.email.localeCompare(b.email) : a.role === "admin" ? -1 : 1
      );
      onData(staff);
    },
    onError
  );
}

export interface CreateStaffAccountParams {
  email: string;
  password: string;
  displayName: string;
  role: StaffRole;
}

/** Gọi Cloud Function createStaffAccount (chỉ admin). */
export async function createStaffAccount(params: CreateStaffAccountParams): Promise<string> {
  const callable = httpsCallable<CreateStaffAccountParams, { uid: string }>(
    functions,
    "createStaffAccount"
  );
  const result = await callable(params);
  return result.data.uid;
}

export interface UpdateStaffAccountParams {
  uid: string;
  role?: StaffRole;
  active?: boolean;
}

/** Gọi Cloud Function updateStaffAccount (chỉ admin): đổi vai trò / khóa / mở khóa. */
export async function updateStaffAccount(params: UpdateStaffAccountParams): Promise<void> {
  const callable = httpsCallable<UpdateStaffAccountParams, { success: boolean }>(
    functions,
    "updateStaffAccount"
  );
  await callable(params);
}
