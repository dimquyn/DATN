// Kiểm thử end-to-end phân quyền + Cloud Functions trên Emulator (Auth, Firestore, Functions).
// Chạy: cd tests && npm run test:e2e
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const PROJECT_ID = "demo-datn-test";
const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, "asia-southeast1");
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "127.0.0.1", 8080);
connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const call = (name, data) => httpsCallable(fns, name)(data);

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code);
    return true;
  });
}

before(async () => {
  // Tài khoản "cũ" tạo trước khi chạy script khởi tạo phân quyền
  await createUserWithEmailAndPassword(auth, "cu@cskh.vn", "123456");
  await signOut(auth);
  execFileSync(process.execPath, [fileURLToPath(new URL("../functions/scripts/seed-staff.mjs", import.meta.url))], {
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    },
    stdio: "ignore",
  });
});

test("seed-staff cấp role staff cho tài khoản cũ, nhân viên không gọi được function quản trị", async () => {
  await signInWithEmailAndPassword(auth, "cu@cskh.vn", "123456");
  const profile = (await getDoc(doc(db, "staff", auth.currentUser.uid))).data();
  assert.equal(profile.role, "staff");
  await getDocs(collection(db, "tickets"));
  await expectCode(
    call("createStaffAccount", { email: "x@cskh.vn", password: "123456", displayName: "X", role: "admin" }),
    "functions/permission-denied"
  );
  await signOut(auth);
});

test("tài khoản tự đăng ký không đọc được dữ liệu, không gọi được function quản trị", async () => {
  await createUserWithEmailAndPassword(auth, "tudangky@x.vn", "123456");
  await expectCode(getDocs(collection(db, "tickets")), "permission-denied");
  await expectCode(
    call("createStaffAccount", { email: "y@cskh.vn", password: "123456", displayName: "Y", role: "admin" }),
    "functions/permission-denied"
  );
  await signOut(auth);
});

test("admin tạo, đổi quyền, khóa và mở khóa tài khoản nhân viên", async () => {
  await signInWithEmailAndPassword(auth, "admin@cskh.vn", "admin123");
  const adminUid = auth.currentUser.uid;
  const { data } = await call("createStaffAccount", {
    email: "NV.Moi@cskh.vn ", password: "matkhau1", displayName: "Nhân viên mới", role: "staff",
  });
  const created = (await getDoc(doc(db, "staff", data.uid))).data();
  assert.equal(created.email, "nv.moi@cskh.vn");
  assert.equal(created.active, true);

  await expectCode(
    call("createStaffAccount", { email: "nv.moi@cskh.vn", password: "matkhau1", displayName: "A", role: "staff" }),
    "functions/already-exists"
  );
  await expectCode(
    call("createStaffAccount", { email: "z@cskh.vn", password: "123", displayName: "A", role: "staff" }),
    "functions/invalid-argument"
  );
  await expectCode(call("updateStaffAccount", { uid: adminUid, active: false }), "functions/failed-precondition");

  await call("updateStaffAccount", { uid: data.uid, role: "admin" });
  assert.equal((await getDoc(doc(db, "staff", data.uid))).data().role, "admin");
  await call("updateStaffAccount", { uid: data.uid, role: "staff", active: false });
  await signOut(auth);

  await expectCode(signInWithEmailAndPassword(auth, "nv.moi@cskh.vn", "matkhau1"), "auth/user-disabled");

  await signInWithEmailAndPassword(auth, "admin@cskh.vn", "admin123");
  await call("updateStaffAccount", { uid: data.uid, active: true });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, "nv.moi@cskh.vn", "matkhau1");
  await getDocs(collection(db, "tickets"));
  await signOut(auth);
});

// Đặt cuối cùng: sau bài này IP 127.0.0.1 bị khóa tra cứu trong 15 phút.
test("tra cứu sai quá 10 lần bị khóa tạm thời", async () => {
  for (let i = 0; i < 10; i++) {
    await expectCode(call("trackTicket", { code: `TK${900 + i}`, phone: "0912345678" }), "functions/not-found");
  }
  await expectCode(call("trackTicket", { code: "TK01", phone: "0912345678" }), "functions/resource-exhausted");
  await expectCode(
    call("submitTicketRating", { code: "TK01", phone: "0912345678", rating: 5 }),
    "functions/resource-exhausted"
  );
});
