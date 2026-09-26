// Kiểm thử các hàm giới hạn (functions/src/limits.ts) và ẩn danh dữ liệu
// (functions/src/retention.ts) trực tiếp bằng Admin SDK trên Firestore Emulator.
// Cần build functions trước: npm --prefix ../functions run build
import { before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const [, portText] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${portText}`;

// Nạp firebase-admin và code đã build từ thư mục functions
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const limits = require("./lib/limits.js");
const retention = require("./lib/retention.js");

let db;

before(() => {
  if (getApps().length === 0) initializeApp({ projectId: "demo-datn-test" });
  db = getFirestore();
});

beforeEach(async () => {
  for (const name of ["ai_usage", "rate_limits", "tickets"]) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
  }
});

test("hạn mức AI theo số điện thoại trong ngày", async () => {
  const now = Date.now();
  for (let i = 0; i < limits.AI_DAILY_LIMIT_PER_PHONE; i++) {
    assert.equal(await limits.reserveAIQuota(db, "0911111111", now), null);
  }
  assert.match(await limits.reserveAIQuota(db, "0911111111", now), /vượt hạn mức/);
  // Số khác vẫn còn hạn mức
  assert.equal(await limits.reserveAIQuota(db, "0922222222", now), null);
  // Sang ngày mới được tính lại
  assert.equal(await limits.reserveAIQuota(db, "0911111111", now + 24 * 3600 * 1000), null);
});

test("hạn mức AI toàn hệ thống trong ngày", async () => {
  const now = Date.now();
  await db.collection("ai_usage").doc(limits.vietnamDateKey(now)).set({ count: limits.AI_DAILY_LIMIT });
  assert.match(await limits.reserveAIQuota(db, "0933333333", now), /vượt hạn mức/);
});

test("khóa tạm theo IP sau quá nhiều lần tra cứu sai, tự mở sau 15 phút", async () => {
  const now = Date.now();
  for (let i = 0; i < limits.LOOKUP_MAX_FAILURES - 1; i++) await limits.recordLookupFailure(db, "1.2.3.4", now);
  assert.equal(await limits.isLookupLocked(db, "1.2.3.4", now), false);
  await limits.recordLookupFailure(db, "1.2.3.4", now);
  assert.equal(await limits.isLookupLocked(db, "1.2.3.4", now), true);
  assert.equal(await limits.isLookupLocked(db, "5.6.7.8", now), false);
  assert.equal(await limits.isLookupLocked(db, "1.2.3.4", now + limits.LOOKUP_WINDOW_MS), false);
});

test("ẩn danh ticket đã đóng quá hạn lưu trữ, giữ nguyên ticket khác", async () => {
  const old = Timestamp.fromMillis(Date.now() - (retention.RETENTION_DAYS + 1) * 24 * 3600 * 1000);
  const base = { customerName: "Lê Văn B", phone: "0912345678", email: "b@gmail.com", content: "x", code: "TK01" };
  await db.collection("tickets").doc("oldClosed").set({ ...base, status: "closed", updatedAt: old });
  await db.collection("tickets").doc("oldOpen").set({ ...base, status: "in_progress", updatedAt: old });
  await db.collection("tickets").doc("newClosed").set({ ...base, status: "closed", updatedAt: Timestamp.now() });

  assert.equal(await retention.anonymizeClosedTickets(db), 1);
  const oldClosed = (await db.collection("tickets").doc("oldClosed").get()).data();
  assert.equal(oldClosed.customerName, retention.ANONYMIZED_NAME);
  assert.equal(oldClosed.phone, "");
  assert.equal(oldClosed.email, "");
  assert.ok(oldClosed.anonymizedAt);
  assert.equal((await db.collection("tickets").doc("oldOpen").get()).data().phone, "0912345678");
  assert.equal((await db.collection("tickets").doc("newClosed").get()).data().phone, "0912345678");
  // Chạy lại không xử lý trùng
  assert.equal(await retention.anonymizeClosedTickets(db), 0);
});
