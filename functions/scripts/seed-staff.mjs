/**
 * Khởi tạo phân quyền nhân viên (collection "staff") — chạy 1 lần sau khi
 * bật phân quyền, hoặc mỗi lần Emulator khởi động lại với dữ liệu trống.
 *
 *  1. Tạo (hoặc giữ nguyên nếu đã có) tài khoản quản trị viên đầu tiên và
 *     gán role "admin" — admin đầu tiên không thể tạo qua app vì chưa có ai
 *     đủ quyền gọi createStaffAccount.
 *  2. Mọi tài khoản Firebase Auth đã có nhưng chưa có document staff/{uid}
 *     được cấp role "staff" (active) để không bị khóa ngoài sau khi bật
 *     phân quyền.
 *
 * Cách chạy (mặc định nối Emulator đang chạy ở 127.0.0.1):
 *   cd functions
 *   npm run seed:staff
 *   npm run seed:staff -- --email admin@cskh.vn --password admin123 --name "Quản trị viên"
 *
 * Chạy trên Firebase project thật: thêm --prod (cần đăng nhập
 * `gcloud auth application-default login` hoặc GOOGLE_APPLICATION_CREDENTIALS).
 */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const useProd = process.argv.includes("--prod");

if (!useProd) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
}

function readDefaultProjectId() {
  try {
    const firebaserc = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8"));
    return firebaserc.projects?.default;
  } catch {
    return undefined;
  }
}

const projectId = process.env.GCLOUD_PROJECT ?? readDefaultProjectId();
const adminEmail = readArg("email", "admin@cskh.vn").trim().toLowerCase();
const adminPassword = readArg("password", "admin123");
const adminName = readArg("name", "Quản trị viên");

initializeApp({ projectId });

const auth = getAuth();
const db = getFirestore();

console.log(
  `Project: ${projectId} (${useProd ? "Firebase THẬT" : `Emulator ${process.env.FIRESTORE_EMULATOR_HOST}`})\n`
);

// 1. Tài khoản admin đầu tiên
let adminUser;
try {
  adminUser = await auth.getUserByEmail(adminEmail);
  console.log(`Đã có tài khoản ${adminEmail} — giữ nguyên mật khẩu hiện tại.`);
} catch (error) {
  if (error.code !== "auth/user-not-found") throw error;
  adminUser = await auth.createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
  console.log(`Đã tạo tài khoản ${adminEmail} / mật khẩu: ${adminPassword}`);
}

await db.collection("staff").doc(adminUser.uid).set(
  {
    email: adminEmail,
    displayName: adminUser.displayName ?? adminName,
    role: "admin",
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  },
  { merge: true }
);
if (adminUser.disabled) await auth.updateUser(adminUser.uid, { disabled: false });

// 2. Cấp role "staff" cho các tài khoản đã có mà chưa có hồ sơ phân quyền
const summary = [{ email: adminEmail, role: "admin", note: "admin" }];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    if (user.uid === adminUser.uid) continue;

    const staffRef = db.collection("staff").doc(user.uid);
    const staffSnap = await staffRef.get();

    if (staffSnap.exists) {
      const data = staffSnap.data();
      summary.push({ email: user.email, role: data.role, note: data.active ? "giữ nguyên" : "giữ nguyên (đang khóa)" });
      continue;
    }

    await staffRef.set({
      email: user.email ?? "",
      displayName: user.displayName ?? null,
      role: "staff",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    summary.push({ email: user.email, role: "staff", note: "mới cấp quyền" });
  }
  pageToken = page.pageToken;
} while (pageToken);

console.log("");
console.table(summary);
process.exit(0);
