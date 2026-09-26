// Kiểm thử tự động firestore.rules trên Firestore Emulator.
// Chạy: cd tests && npm install && npm test
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

// emulators:exec đặt FIRESTORE_EMULATOR_HOST (có thể là 0.0.0.0 theo
// firebase.json) — luôn kết nối qua 127.0.0.1 để chạy được cả trên Windows.
const [, portText] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");

let env;
let anon, staffA, staffB, admin, selfSignup, locked;
let phoneSeq = 0;
const nextPhone = () => `09${String(10000000 + ++phoneSeq).slice(-8)}`;

const validTicket = (phone) => ({
  customerName: "Nguyễn Văn A",
  phone,
  email: "khach@gmail.com",
  content: "Mạng 4G chập chờn suốt 3 ngày nay không dùng được",
  channel: "Website",
  status: "pending",
  assignedTo: null,
  aiResultId: null,
});

/** Mô phỏng đúng transaction tạo ticket ở website/src/hooks/useComplaintForm.ts. */
function createTicket(db, overrides = {}, opts = {}) {
  const phone = overrides.phone ?? nextPhone();
  const ticketRef = doc(collection(db, "tickets"));
  const historyRef = doc(collection(ticketRef, "history"));
  const counterRef = doc(db, "counters", "tickets");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const n = (snap.exists() ? snap.data().count : 0) + 1;
    const code = opts.code ?? `TK${String(n).padStart(2, "0")}`;
    if (!opts.skipCounter) tx.set(counterRef, { count: n, lastTicketId: ticketRef.id });
    if (!opts.skipCooldown) {
      tx.set(doc(db, "phone_cooldowns", phone), { lastAt: serverTimestamp(), ticketId: ticketRef.id });
    }
    tx.set(ticketRef, {
      ...validTicket(phone),
      ...overrides,
      phone,
      code,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(historyRef, {
      ticketId: ticketRef.id,
      ticketCode: code,
      action: "created",
      actorName: "Hệ thống",
      createdAt: serverTimestamp(),
    });
    return ticketRef.id;
  });
}

/** Tạo sẵn ticket với trạng thái tùy ý (bỏ qua rules) để kiểm thử các bước xử lý. */
async function seedTicket(data) {
  const id = `t${Math.random().toString(36).slice(2, 10)}`;
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "tickets", id), {
      ...validTicket(nextPhone()),
      code: "TK99",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ...data,
    })
  );
  return id;
}

/** Cập nhật ticket + ghi lịch sử trong cùng batch như mobile/src/services/ticket.service.ts. */
function updateWithHistory(db, ticketId, updates, action, actorUid, historyOverrides = {}) {
  const batch = writeBatch(db);
  batch.update(doc(db, "tickets", ticketId), { ...updates, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "tickets", ticketId, "history")), {
    ticketId,
    ticketCode: "TK99",
    action,
    actorName: "nhanvien@cskh.vn",
    actorUid,
    createdAt: serverTimestamp(),
    ...historyOverrides,
  });
  return batch.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-datn-test",
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: Number(portText),
    },
  });
  anon = env.unauthenticatedContext().firestore();
  staffA = env.authenticatedContext("staffA").firestore();
  staffB = env.authenticatedContext("staffB").firestore();
  admin = env.authenticatedContext("admin1").firestore();
  selfSignup = env.authenticatedContext("selfSignup").firestore();
  locked = env.authenticatedContext("lockedC").firestore();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "staff", "staffA"), { email: "a@cskh.vn", role: "staff", active: true });
    await setDoc(doc(db, "staff", "staffB"), { email: "b@cskh.vn", role: "staff", active: true });
    await setDoc(doc(db, "staff", "admin1"), { email: "admin@cskh.vn", role: "admin", active: true });
    await setDoc(doc(db, "staff", "lockedC"), { email: "c@cskh.vn", role: "staff", active: false });
  });
});

after(async () => {
  await env?.cleanup();
});

// ---------------------------------------------------------------- Tạo ticket
test("khách tạo ticket hợp lệ, mã tuần tự qua mốc 2 chữ số", async () => {
  for (let i = 0; i < 10; i++) await assertSucceeds(createTicket(anon));
  await assertSucceeds(createTicket(anon)); // TK11
});

test("rules chặn dữ liệu sai định dạng khi gọi thẳng Firestore SDK", async () => {
  await assertFails(createTicket(anon, { phone: "12345" }));
  await assertFails(createTicket(anon, { phone: "0112345678" }));
  await assertFails(createTicket(anon, { email: "abc" }));
  await assertFails(createTicket(anon, { email: `${"a".repeat(95)}@x.com` }));
  await assertFails(createTicket(anon, { content: "ngắn quá" }));
  await assertFails(createTicket(anon, { content: " ".repeat(40) }));
  await assertFails(createTicket(anon, { content: "a".repeat(1001) }));
  await assertFails(createTicket(anon, { customerName: "   " }));
  await assertFails(createTicket(anon, { customerName: "a".repeat(101) }));
  await assertFails(createTicket(anon, { channel: "Telegram" }));
  await assertFails(createTicket(anon, { assignedTo: "staffA" }));
  await assertFails(createTicket(anon, { status: "closed" }));
});

test("không tự đặt mã ticket, không tạo ticket mà bỏ qua bộ đếm", async () => {
  await assertSucceeds(createTicket(anon));
  await assertFails(createTicket(anon, {}, { code: "TK01" }));
  await assertFails(createTicket(anon, {}, { skipCounter: true }));
});

test("không tăng bộ đếm suông, không ghi thời gian chờ suông", async () => {
  await assertFails(setDoc(doc(anon, "counters", "tickets"), { count: 1 }));
  await assertFails(setDoc(doc(anon, "counters", "tickets"), { count: 1, lastTicketId: "khongtontai" }));
  await assertFails(setDoc(doc(anon, "phone_cooldowns", "0912345678"), { lastAt: serverTimestamp(), ticketId: "x" }));
});

test("cùng 1 số điện thoại phải chờ 30 giây giữa 2 lần gửi", async () => {
  const phone = nextPhone();
  await assertSucceeds(createTicket(anon, { phone }));
  await assertFails(createTicket(anon, { phone }));
  await assertSucceeds(createTicket(anon, { phone: nextPhone() }));
  // Giả lập đã qua 1 phút
  await env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), "phone_cooldowns", phone), {
      lastAt: Timestamp.fromMillis(Date.now() - 60_000),
    })
  );
  await assertSucceeds(createTicket(anon, { phone }));
});

test("bắt buộc ghi thời gian chờ kèm ticket; client không đọc được", async () => {
  await assertFails(createTicket(anon, {}, { skipCooldown: true }));
  await assertFails(getDoc(doc(anon, "phone_cooldowns", "0912345678")));
  await assertFails(getDoc(doc(staffA, "phone_cooldowns", "0912345678")));
});

test("không chèn dòng lịch sử 'created' giả vào ticket đã có", async () => {
  const id = await createTicket(anon);
  await assertFails(
    setDoc(doc(anon, "tickets", id, "history", "fake"), {
      ticketId: id, ticketCode: "TK01", action: "created", actorName: "x", createdAt: serverTimestamp(),
    })
  );
});

// ---------------------------------------------------------------- Phân quyền
test("chỉ tài khoản có hồ sơ staff đang hoạt động mới đọc được ticket", async () => {
  const id = await seedTicket({});
  await assertFails(getDoc(doc(anon, "tickets", id)));
  await assertFails(getDoc(doc(selfSignup, "tickets", id)));
  await assertFails(getDoc(doc(locked, "tickets", id)));
  await assertSucceeds(getDoc(doc(staffA, "tickets", id)));
  await assertFails(getDoc(doc(selfSignup, "ai_results", "r1")));
});

test("hồ sơ staff: đọc của mình, admin đọc hết, không ai ghi từ client", async () => {
  await assertSucceeds(getDoc(doc(locked, "staff", "lockedC")));
  await assertSucceeds(getDoc(doc(selfSignup, "staff", "selfSignup")));
  await assertFails(getDoc(doc(staffA, "staff", "staffB")));
  await assertFails(getDocs(collection(staffA, "staff")));
  await assertSucceeds(getDocs(collection(admin, "staff")));
  await assertFails(setDoc(doc(selfSignup, "staff", "selfSignup"), { email: "x", role: "admin", active: true }));
  await assertFails(updateDoc(doc(staffA, "staff", "staffA"), { role: "admin" }));
  await assertFails(updateDoc(doc(admin, "staff", "staffA"), { role: "admin" }));
});

test("dữ liệu hạn mức (ai_usage, rate_limits) client không đọc/ghi được", async () => {
  await assertFails(getDoc(doc(admin, "ai_usage", "2026-01-01")));
  await assertFails(setDoc(doc(anon, "rate_limits", "lookup_1"), { failures: 0 }));
});

// ---------------------------------------------------------------- Xử lý ticket
test("luồng xử lý: chỉ người nhận mới phản hồi/đóng, kèm đúng dòng lịch sử", async () => {
  const id = await seedTicket({ status: "ai_analyzed" });
  await assertSucceeds(
    updateWithHistory(staffA, id, { status: "in_progress", assignedTo: "staffA", assignedToName: "a" }, "claimed", "staffA")
  );
  await assertFails(
    updateWithHistory(staffB, id, { status: "in_progress", assignedTo: "staffB" }, "claimed", "staffB")
  );
  await assertFails(updateWithHistory(staffB, id, { status: "responded", finalReply: "x" }, "responded", "staffB"));
  await assertSucceeds(updateWithHistory(staffA, id, { status: "responded", finalReply: "x" }, "responded", "staffA"));
  await assertFails(updateWithHistory(staffB, id, { status: "closed" }, "closed", "staffB"));
  await assertSucceeds(updateWithHistory(staffA, id, { status: "closed" }, "closed", "staffA"));
});

test("nhận xử lý ticket AI lỗi (pending + lastAIError)", async () => {
  const id = await seedTicket({ status: "pending", lastAIError: "quota" });
  await assertSucceeds(
    updateWithHistory(staffA, id, { status: "in_progress", assignedTo: "staffA" }, "claimed", "staffA")
  );
});

test("lịch sử: không ghi tùy ý, không mạo danh, action phải khớp trạng thái", async () => {
  const id = await seedTicket({ status: "in_progress", assignedTo: "staffA" });
  // Ghi riêng lẻ, không kèm cập nhật ticket
  await assertFails(
    setDoc(doc(staffA, "tickets", id, "history", "h1"), {
      ticketId: id, ticketCode: "TK99", action: "closed", actorName: "a", actorUid: "staffA", createdAt: serverTimestamp(),
    })
  );
  // Mạo danh actorUid của người khác
  await assertFails(
    updateWithHistory(staffA, id, { status: "responded", finalReply: "x" }, "responded", "staffA", { actorUid: "staffB" })
  );
  // action không khớp trạng thái mới
  await assertFails(updateWithHistory(staffA, id, { status: "responded", finalReply: "x" }, "closed", "staffA"));
  // Tài khoản tự đăng ký không ghi được lịch sử
  await assertFails(updateWithHistory(selfSignup, id, { status: "responded", finalReply: "x" }, "responded", "selfSignup"));
});

test("admin chuyển người xử lý; nhân viên thường không chuyển được", async () => {
  const id = await seedTicket({ status: "in_progress", assignedTo: "staffA", assignedToName: "a" });
  const reassign = (db, uid, to) =>
    updateWithHistory(db, id, { assignedTo: to, assignedToName: to }, "reassigned", uid);
  await assertFails(reassign(staffB, "staffB", "staffB"));
  await assertFails(reassign(admin, "admin1", "lockedC"));
  await assertFails(reassign(admin, "admin1", "selfSignup"));
  await assertFails(
    updateWithHistory(admin, id, { status: "responded", assignedTo: "staffB" }, "reassigned", "admin1")
  );
  await assertSucceeds(reassign(admin, "admin1", "staffB"));
  await assertFails(updateWithHistory(staffA, id, { status: "responded", finalReply: "x" }, "responded", "staffA"));
  await assertSucceeds(updateWithHistory(staffB, id, { status: "responded", finalReply: "x" }, "responded", "staffB"));
  await assertFails(reassign(admin, "admin1", "staffA")); // đã responded
  await assertSucceeds(updateWithHistory(admin, id, { status: "closed" }, "closed", "admin1"));
});

test("ai_results chỉ Cloud Functions ghi", async () => {
  await assertFails(setDoc(doc(admin, "ai_results", "r1"), { ticketId: "x" }));
});
