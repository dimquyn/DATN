// Script đánh giá độ chính xác của Gemini trên tập dữ liệu khiếu nại có gán
// nhãn sẵn (ground truth) — dùng cho chương "Đánh giá hệ thống" trong báo cáo.
//
// Cách chạy:
//   cd eval
//   npm install
//   GEMINI_API_KEY=xxxxx npm run eval                 # tập test-set.json
//   GEMINI_API_KEY=xxxxx npm run eval:500             # tập test-set-500.json
//
// Chạy tiếp từ chỗ dừng: kết quả từng mẫu được lưu ngay vào file progress
// (progress.json, progress-500.json...). Chạy lại đúng lệnh cũ thì script bỏ
// qua các mẫu đã xong, chỉ gọi Gemini cho các mẫu còn lại hoặc bị lỗi lần
// trước. Khi gặp lỗi hết quota (429), script tự dừng, giữ nguyên tiến độ —
// hôm sau chạy lại lệnh cũ là được.
//
// Tùy chọn:
//   --limit N       chỉ gọi tối đa N mẫu trong lần chạy này (VD: --limit 20)
//   --reset         xóa tiến độ cũ, chạy lại từ đầu
//   --report-only   không gọi Gemini, chỉ tạo lại báo cáo từ tiến độ đã có
//   --batch N       gộp N khiếu nại vào 1 lần gọi (chỉ lấy category/priority/
//                   sentiment) để chạy đủ tập lớn trong quota miễn phí
//
// Kết quả ghi ra eval/report*.md (đọc được ngay) và eval/results*.json (dữ
// liệu thô từng mẫu, dùng làm phụ lục nếu cần).

import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));
const MODEL = "gemini-2.5-flash";
const DELAY_BETWEEN_CALLS_MS = Number(process.env.EVAL_DELAY_MS ?? 4000); // né rate limit free tier của Gemini
const MAX_RETRIES = 2;
const QUOTA_WAIT_MS = 65_000; // 429 theo phút thì chờ hơn 1 phút là gọi lại được
const QUOTA_MAX_WAITS = 2; // vẫn 429 sau 2 lần chờ → coi như hết quota trong ngày
const OVERLOAD_WAITS_MS = [30_000, 60_000, 120_000, 240_000]; // 503 quá tải: chờ lâu dần, hết lượt thì dừng

// ============================================================
// Sao chép NGUYÊN VĂN từ functions/src/index.ts (buildPrompt +
// AI_RESPONSE_SCHEMA) — nếu sửa prompt/schema thật thì phải đồng bộ tay lại
// 2 khối này để kết quả đánh giá phản ánh đúng hệ thống đang chạy.
// ============================================================
const AI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: ["Gói cước/Dữ liệu", "SIM", "Đường truyền", "Thanh toán", "Khác"],
      description: "Phân loại nhóm khiếu nại",
    },
    priority: {
      type: Type.STRING,
      enum: ["High Priority", "Medium", "Low"],
      description: "Mức độ ưu tiên xử lý",
    },
    sentiment: {
      type: Type.STRING,
      enum: ["Tích cực", "Trung lập", "Tiêu cực", "Rất tiêu cực"],
      description: "Cảm xúc/thái độ của khách hàng trong nội dung khiếu nại",
    },
    summary: { type: Type.STRING, description: "Tóm tắt ngắn gọn nội dung khiếu nại trong 1-2 câu" },
    suggestion: { type: Type.STRING, description: "Gợi ý hướng xử lý nội bộ dành cho nhân viên CSKH" },
    reply: { type: Type.STRING, description: "Mẫu phản hồi lịch sự, chuyên nghiệp có thể gửi thẳng cho khách hàng" },
  },
  required: ["category", "priority", "sentiment", "summary", "suggestion", "reply"],
};

function buildPrompt({ customerName, content, channel }) {
  return `Bạn là một nhân viên chăm sóc khách hàng (CSKH) giàu kinh nghiệm của một doanh nghiệp viễn thông tại Việt Nam.

Nhiệm vụ của bạn là đọc nội dung khiếu nại dưới đây và phân tích một cách khách quan, chuyên nghiệp.

Thông tin khiếu nại:
- Khách hàng: ${customerName}
- Kênh gửi: ${channel}
- Nội dung khiếu nại: "${content}"

Hãy phân tích và trả về kết quả theo đúng cấu trúc JSON đã được quy định, bao gồm:
1. category: phân loại khiếu nại vào đúng 1 trong 5 nhóm cho trước.
2. priority: đánh giá mức độ ưu tiên xử lý dựa trên mức độ ảnh hưởng và cảm xúc khách hàng.
3. sentiment: nhận định thái độ/cảm xúc của khách hàng qua văn phong.
4. summary: tóm tắt ngắn gọn, súc tích nội dung khiếu nại.
5. suggestion: gợi ý hướng xử lý nội bộ dành cho nhân viên (không phải câu trả lời gửi khách).
6. reply: soạn một mẫu phản hồi lịch sự, thể hiện sự thấu hiểu, có thể gửi trực tiếp cho khách hàng.

Lưu ý khi soạn "reply": khách hàng đã cung cấp đầy đủ thông tin liên hệ (họ tên, số điện thoại, email) ngay khi gửi khiếu nại, hệ thống đã lưu lại đầy đủ. Không yêu cầu khách cung cấp lại số điện thoại, mã số thuê bao hay bất kỳ thông tin liên hệ nào đã có sẵn.

Chỉ trả về JSON, không thêm bất kỳ văn bản giải thích nào khác.`;
}
// ============================================================ (hết phần sao chép)

const FIELDS = ["category", "priority", "sentiment"];
const LABELS = Object.fromEntries(FIELDS.map((field) => [field, AI_RESPONSE_SCHEMA.properties[field].enum]));

// ============================================================
// Chế độ gọi theo lô (--batch N): gộp N khiếu nại vào 1 lần gọi, chỉ lấy 3
// trường phân loại, để chạy đủ tập lớn trong quota miễn phí (~20 lượt/ngày).
// Vai trò, 3 hướng dẫn phân loại và tập nhãn (enum) giữ đúng như prompt/schema
// của hệ thống ở trên; khác biệt: không sinh summary/suggestion/reply và
// Gemini đọc nhiều khiếu nại trong 1 lần — báo cáo ghi rõ mẫu nào chạy chế độ
// này và tách riêng độ chính xác của từng chế độ.
// ============================================================
const BATCH_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Mã khiếu nại, chép đúng như trong danh sách" },
      ...Object.fromEntries(FIELDS.map((field) => [field, AI_RESPONSE_SCHEMA.properties[field]])),
    },
    required: ["id", ...FIELDS],
  },
};

function buildBatchPrompt(samples) {
  const list = samples
    .map((sample) => `[${sample.id}] Khách hàng: ${sample.customerName} | Kênh gửi: ${sample.channel} | Nội dung khiếu nại: "${sample.content}"`)
    .join("\n");
  return `Bạn là một nhân viên chăm sóc khách hàng (CSKH) giàu kinh nghiệm của một doanh nghiệp viễn thông tại Việt Nam.

Nhiệm vụ của bạn là đọc từng khiếu nại dưới đây và phân tích một cách khách quan, chuyên nghiệp. Mỗi khiếu nại được phân tích độc lập, không để khiếu nại này ảnh hưởng tới khiếu nại khác.

Danh sách ${samples.length} khiếu nại:
${list}

Với MỖI khiếu nại, trả về một phần tử trong mảng JSON theo đúng cấu trúc đã được quy định, bao gồm:
- id: mã khiếu nại trong ngoặc vuông, chép đúng nguyên văn.
1. category: phân loại khiếu nại vào đúng 1 trong 5 nhóm cho trước.
2. priority: đánh giá mức độ ưu tiên xử lý dựa trên mức độ ảnh hưởng và cảm xúc khách hàng.
3. sentiment: nhận định thái độ/cảm xúc của khách hàng qua văn phong.

Trả về đủ ${samples.length} phần tử, đúng thứ tự trong danh sách. Chỉ trả về JSON, không thêm bất kỳ văn bản giải thích nào khác.`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isQuotaError(error) {
  const text = `${error?.status ?? ""} ${error?.message ?? error ?? ""}`;
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text);
}

// Máy chủ Gemini quá tải (503) hoặc lỗi tạm thời phía Google: chờ rồi thử lại.
function isOverloadError(error) {
  const text = `${error?.status ?? ""} ${error?.message ?? error ?? ""}`;
  return /\b(500|503)\b|UNAVAILABLE|overloaded|high demand/i.test(text);
}

// Key sai / chưa bật quyền gọi Gemini: gọi lại bao nhiêu lần cũng lỗi → dừng ngay.
function isAuthError(error) {
  const text = `${error?.status ?? ""} ${error?.message ?? error ?? ""}`;
  return /\b(401|403)\b|API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text);
}

// Băm nội dung gọi AI để biết mẫu có bị sửa sau lần chạy trước không — nhãn
// đúng thì luôn đọc từ tập test hiện tại, nên chỉ sửa nhãn không cần chạy lại.
function sampleHash(sample) {
  return createHash("sha256")
    .update(JSON.stringify([sample.customerName, sample.channel, sample.content]))
    .digest("hex")
    .slice(0, 16);
}

// Gọi Gemini có thử lại. Trả về { ok, latencyMs, parsed } | { ok: false, quota, auth, overload, error }.
async function callGemini(ai, prompt, responseSchema, { wait = sleep } = {}) {
  let lastError;
  let quotaWaits = 0;
  let overloadWaits = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; ) {
    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      return { ok: true, latencyMs: Date.now() - startedAt, parsed: JSON.parse(response.text) };
    } catch (error) {
      lastError = error;
      if (isAuthError(error)) break;
      if (isQuotaError(error)) {
        if (quotaWaits >= QUOTA_MAX_WAITS) break;
        quotaWaits += 1;
        console.log(`\n  Gemini báo 429 (giới hạn lượt gọi), chờ ${QUOTA_WAIT_MS / 1000} giây rồi thử lại...`);
        await wait(QUOTA_WAIT_MS);
        continue; // chờ quota không tính vào số lần thử lại
      }
      if (isOverloadError(error)) {
        if (overloadWaits >= OVERLOAD_WAITS_MS.length) break;
        const waitMs = OVERLOAD_WAITS_MS[overloadWaits];
        overloadWaits += 1;
        console.log(`\n  Gemini đang quá tải (503), chờ ${waitMs / 1000} giây rồi thử lại (lần ${overloadWaits}/${OVERLOAD_WAITS_MS.length})...`);
        await wait(waitMs);
        continue;
      }
      attempt += 1;
      if (attempt <= MAX_RETRIES) await wait(DELAY_BETWEEN_CALLS_MS * 2);
    }
  }

  return {
    ok: false,
    quota: isQuotaError(lastError),
    auth: isAuthError(lastError),
    overload: isOverloadError(lastError),
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

// 1 khiếu nại / 1 lần gọi, đúng prompt + schema của hệ thống.
async function analyzeOne(ai, sample, options) {
  const outcome = await callGemini(ai, buildPrompt(sample), AI_RESPONSE_SCHEMA, options);
  return outcome.ok ? { ok: true, latencyMs: outcome.latencyMs, result: outcome.parsed } : outcome;
}

// N khiếu nại / 1 lần gọi. Trả về kết quả theo id; mẫu thiếu trong câu trả lời
// thì không có trong resultsById (sẽ ghi lỗi và được gọi lại lần sau).
async function analyzeBatch(ai, samples, options) {
  const outcome = await callGemini(ai, buildBatchPrompt(samples), BATCH_RESPONSE_SCHEMA, options);
  if (!outcome.ok) return outcome;
  const wanted = new Set(samples.map((sample) => sample.id));
  const resultsById = {};
  for (const item of Array.isArray(outcome.parsed) ? outcome.parsed : []) {
    const valid = wanted.has(item?.id) && FIELDS.every((field) => LABELS[field].includes(item[field]));
    if (valid && !resultsById[item.id]) resultsById[item.id] = Object.fromEntries(FIELDS.map((field) => [field, item[field]]));
  }
  return { ok: true, latencyMs: outcome.latencyMs, resultsById };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(index, 0)];
}

function emptyMatrix(labels) {
  return Object.fromEntries(labels.map((label) => [label, Object.fromEntries(labels.map((l) => [l, 0]))]));
}

function buildConfusionMatrixMarkdown(matrix, labels) {
  const header = `| Thực tế \\ AI đoán | ${labels.join(" | ")} |`;
  const separator = `| --- | ${labels.map(() => "---").join(" | ")} |`;
  const rows = labels.map((expected) => {
    const cells = labels.map((predicted) => matrix[expected]?.[predicted] ?? 0);
    return `| **${expected}** | ${cells.join(" | ")} |`;
  });
  return [header, separator, ...rows].join("\n");
}

// Precision/recall/F1 từng nhãn + macro-F1, tính từ ma trận nhầm lẫn.
function perClassMetrics(matrix, labels) {
  const rows = labels.map((label) => {
    const tp = matrix[label][label];
    const support = labels.reduce((sum, predicted) => sum + matrix[label][predicted], 0);
    const predictedCount = labels.reduce((sum, expected) => sum + matrix[expected][label], 0);
    const precision = predictedCount ? tp / predictedCount : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, precision, recall, f1, support };
  });
  const withSupport = rows.filter((row) => row.support > 0);
  const macroF1 = withSupport.length ? withSupport.reduce((sum, row) => sum + row.f1, 0) / withSupport.length : 0;
  return { rows, macroF1 };
}

const pct = (value) => `${(value * 100).toFixed(1)}%`;

function computeStats(testSet, progressResults) {
  const evaluated = [];
  for (const sample of testSet) {
    const entry = progressResults[sample.id];
    if (entry?.ok && entry.hash === sampleHash(sample)) evaluated.push({ sample, entry });
  }
  const failed = testSet.filter((sample) => progressResults[sample.id] && !progressResults[sample.id].ok);

  const matrices = Object.fromEntries(FIELDS.map((field) => [field, emptyMatrix(LABELS[field])]));
  const correct = Object.fromEntries(FIELDS.map((field) => [field, 0]));
  const groups = {}; // độ chính xác theo kiểu viết / ca khó (nếu tập test có các trường này)
  const latencies = [];
  const perSample = [];

  const modeCounts = { single: 0, batch: 0 };
  for (const { sample, entry } of evaluated) {
    const mode = entry.mode === "batch" ? "batch" : "single";
    modeCounts[mode] += 1;
    if (mode === "single") latencies.push(entry.latencyMs); // 1 lần gọi theo lô xử lý nhiều mẫu nên không tính độ trễ
    const match = {};
    for (const field of FIELDS) {
      const expected = sample[`expected_${field}`];
      const actual = entry.result[field];
      match[field] = expected === actual;
      if (match[field]) correct[field] += 1;
      if (matrices[field][expected] && actual in matrices[field][expected]) matrices[field][expected][actual] += 1;
    }
    const groupKeys = [mode === "batch" ? "Chế độ gọi: theo lô" : "Chế độ gọi: đơn lẻ (đúng prompt hệ thống)"];
    if (sample.style) groupKeys.push(`Kiểu viết: ${sample.style}`);
    if (typeof sample.hard === "boolean") groupKeys.push(sample.hard ? "Ca khó" : "Ca thường");
    for (const key of groupKeys) {
      groups[key] ??= { total: 0, category: 0, priority: 0, sentiment: 0 };
      groups[key].total += 1;
      for (const field of FIELDS) if (match[field]) groups[key][field] += 1;
    }
    perSample.push({
      id: sample.id,
      content: sample.content,
      expected: Object.fromEntries(FIELDS.map((field) => [field, sample[`expected_${field}`]])),
      actual: Object.fromEntries(FIELDS.map((field) => [field, entry.result[field]])),
      match,
      mode,
      latencyMs: mode === "single" ? entry.latencyMs : undefined,
      summary: entry.result.summary,
      suggestion: entry.result.suggestion,
      reply: entry.result.reply,
    });
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  return {
    evaluatedCount: evaluated.length,
    modeCounts,
    failed,
    correct,
    matrices,
    groups,
    perSample,
    latency: {
      avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p95: Math.round(percentile(sortedLatencies, 95)),
      min: sortedLatencies[0] ?? 0,
      max: sortedLatencies[sortedLatencies.length - 1] ?? 0,
      count: latencies.length,
    },
  };
}

function buildReport({ testSet, testSetName, stats, resultsFile }) {
  const n = stats.evaluatedCount;
  const remaining = testSet.length - n;
  const lines = [
    "# Báo cáo đánh giá độ chính xác AI phân tích khiếu nại",
    "",
    `- Ngày tạo báo cáo: ${new Date().toISOString()}`,
    `- Model: ${MODEL}`,
    `- Tập test: ${testSetName} (${testSet.length} mẫu)`,
    `- Số mẫu đã đánh giá: ${n}/${testSet.length}${remaining ? ` — CHƯA XONG, còn ${remaining} mẫu (chạy lại lệnh cũ để chạy tiếp)` : ""}`,
  ];
  if (remaining) lines.push("- Mẫu được chạy xen kẽ theo nhóm khiếu nại nên phần đã đánh giá chia đều 5 nhóm (xem cột Số mẫu ở bảng category).");
  if (stats.modeCounts.batch) {
    lines.push(
      `- Chế độ gọi: ${stats.modeCounts.single} mẫu gọi đơn lẻ (đúng prompt hệ thống, 1 khiếu nại/lần gọi), ` +
        `${stats.modeCounts.batch} mẫu gọi theo lô (nhiều khiếu nại/lần gọi, chỉ lấy 3 trường phân loại) — độ chính xác từng chế độ ở bảng "theo nhóm mẫu".`
    );
  }
  if (stats.failed.length) lines.push(`- Số mẫu lỗi ở lần gọi gần nhất: ${stats.failed.length} (sẽ được gọi lại ở lần chạy sau)`);
  lines.push(
    "",
    "## Độ chính xác theo từng trường",
    "",
    "| Trường | Đúng / Tổng | Accuracy | Macro-F1 |",
    "| --- | --- | --- | --- |",
    ...FIELDS.map((field) => {
      const { macroF1 } = perClassMetrics(stats.matrices[field], LABELS[field]);
      return `| ${field} | ${stats.correct[field]}/${n} | ${n ? pct(stats.correct[field] / n) : "0.0%"} | ${pct(macroF1)} |`;
    })
  );

  for (const field of FIELDS) {
    const { rows } = perClassMetrics(stats.matrices[field], LABELS[field]);
    lines.push(
      "",
      `## ${field}: ma trận nhầm lẫn và chỉ số từng nhãn`,
      "",
      buildConfusionMatrixMarkdown(stats.matrices[field], LABELS[field]),
      "",
      "| Nhãn | Precision | Recall | F1 | Số mẫu |",
      "| --- | --- | --- | --- | --- |",
      ...rows.map((row) => `| ${row.label} | ${pct(row.precision)} | ${pct(row.recall)} | ${pct(row.f1)} | ${row.support} |`)
    );
  }

  const groupKeys = Object.keys(stats.groups).sort();
  if (groupKeys.length) {
    lines.push(
      "",
      "## Độ chính xác theo nhóm mẫu (chế độ gọi, kiểu viết, độ khó)",
      "",
      "| Nhóm mẫu | Số mẫu | category | priority | sentiment |",
      "| --- | --- | --- | --- | --- |",
      ...groupKeys.map((key) => {
        const g = stats.groups[key];
        return `| ${key} | ${g.total} | ${pct(g.category / g.total)} | ${pct(g.priority / g.total)} | ${pct(g.sentiment / g.total)} |`;
      })
    );
  }

  lines.push(
    "",
    "## Độ trễ phân tích (thời gian gọi Gemini API)",
    "",
    `Tính trên ${stats.latency.count} lần gọi đơn lẻ (mỗi lần 1 khiếu nại, đúng như hệ thống chạy thật).`,
    "",
    `- Trung bình: ${stats.latency.avg}ms`,
    `- p95: ${stats.latency.p95}ms`,
    `- Min/Max: ${stats.latency.min}ms / ${stats.latency.max}ms`,
    "",
    "## Các mẫu AI đoán sai ít nhất một trường",
    "",
    "| ID | Category | Priority | Sentiment |",
    "| --- | --- | --- | --- |",
    ...stats.perSample
      .filter((r) => !(r.match.category && r.match.priority && r.match.sentiment))
      .map((r) =>
        `| ${r.id} | ${FIELDS.map((field) =>
          r.match[field] ? "✓" : `✗ (kỳ vọng ${r.expected[field]}, AI: ${r.actual[field]})`
        ).join(" | ")} |`
      ),
    "",
    `Chi tiết đầy đủ từng mẫu (kèm summary, suggestion, reply) trong ${resultsFile}.`
  );
  return lines.join("\n");
}

async function writeJsonAtomic(path, data) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, path);
}

function parseArgs(argv) {
  const options = { testSetPath: join(EVAL_DIR, "test-set.json"), limit: Infinity, batch: 1, reset: false, reportOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit") options.limit = Number(argv[++i]);
    else if (arg === "--batch") options.batch = Number(argv[++i]);
    else if (arg === "--reset") options.reset = true;
    else if (arg === "--report-only") options.reportOnly = true;
    else if (!arg.startsWith("--")) options.testSetPath = resolve(EVAL_DIR, arg);
    else throw new Error(`Không hiểu tùy chọn: ${arg}`);
  }
  if (!(options.limit > 0)) throw new Error("--limit phải là số dương");
  if (!Number.isInteger(options.batch) || options.batch < 1) throw new Error("--batch phải là số nguyên dương");
  return options;
}

// Thứ tự gọi xen kẽ 5 nhóm (mẫu 1 nhóm A, mẫu 1 nhóm B, ...) để nếu hết quota
// giữa chừng thì phần đã chạy vẫn chia đều các nhóm, dùng được làm số liệu.
function interleaveByCategory(testSet) {
  const queues = LABELS.category.map((label) => testSet.filter((sample) => sample.expected_category === label));
  const others = testSet.filter((sample) => !LABELS.category.includes(sample.expected_category));
  const ordered = [];
  for (let i = 0; queues.some((queue) => i < queue.length); i += 1) {
    for (const queue of queues) if (i < queue.length) ordered.push(queue[i]);
  }
  return [...ordered, ...others];
}

// test-set.json → report.md / results.json / progress.json
// test-set-500.json → report-500.md / results-500.json / progress-500.json
function outputPaths(testSetPath) {
  const suffix = basename(testSetPath, ".json").replace(/^test-set/, "");
  return {
    progress: join(EVAL_DIR, `progress${suffix}.json`),
    report: join(EVAL_DIR, `report${suffix}.md`),
    results: join(EVAL_DIR, `results${suffix}.json`),
  };
}

export async function runEvaluation({ ai, testSetPath, limit = Infinity, batch = 1, reset = false, reportOnly = false, wait = sleep }) {
  const testSet = JSON.parse(await readFile(testSetPath, "utf-8"));
  const paths = outputPaths(testSetPath);
  const testSetName = basename(testSetPath);

  if (reset) await unlink(paths.progress).catch(() => {});
  let progress = { testSet: testSetName, model: MODEL, results: {} };
  try {
    progress = JSON.parse(await readFile(paths.progress, "utf-8"));
  } catch {
    // chưa có tiến độ: chạy từ đầu
  }

  const isDone = (sample) => progress.results[sample.id]?.ok && progress.results[sample.id].hash === sampleHash(sample);
  const pending = interleaveByCategory(testSet).filter((sample) => !isDone(sample));
  const toRun = reportOnly ? [] : pending.slice(0, limit);
  const units = []; // mỗi phần tử = các mẫu của 1 lần gọi Gemini
  for (let i = 0; i < toRun.length; i += batch) units.push(toRun.slice(i, i + batch));

  console.log(
    `Tập ${testSetName}: ${testSet.length} mẫu, đã xong ${testSet.length - pending.length}, còn ${pending.length}.` +
      (toRun.length
        ? ` Lần này chạy ${toRun.length} mẫu trong ${units.length} lần gọi${batch > 1 ? ` (lô ${batch} mẫu/lần)` : ""}, cách nhau ${DELAY_BETWEEN_CALLS_MS}ms.`
        : "")
  );

  const markLine = (sample, result) =>
    FIELDS.map((field) => `${result[field] === sample[`expected_${field}`] ? "✓" : "✗"} ${field}`).join(", ");

  let stoppedByQuota = false;
  let stoppedByAuth = false;
  let stoppedByOverload = false;
  for (const [index, unit] of units.entries()) {
    const label = unit.length === 1 ? unit[0].id : `${unit[0].id}…${unit[unit.length - 1].id} (${unit.length} mẫu)`;
    process.stdout.write(`[${index + 1}/${units.length}] ${label} ... `);
    const outcome = batch > 1 ? await analyzeBatch(ai, unit, { wait }) : await analyzeOne(ai, unit[0], { wait });
    const at = new Date().toISOString();

    if (outcome.auth) {
      // lỗi do key chứ không do mẫu: không ghi vào tiến độ
      console.log(`LỖI: ${outcome.error}`);
      stoppedByAuth = true;
      break;
    }
    if (outcome.overload) {
      // Gemini quá tải chung, gọi tiếp các lô sau cũng lỗi → dừng, mẫu chưa chạy giữ nguyên để lần sau chạy
      console.log(`LỖI: ${outcome.error}`);
      stoppedByOverload = true;
      break;
    }
    if (!outcome.ok) {
      for (const sample of unit) progress.results[sample.id] = { ok: false, hash: sampleHash(sample), error: outcome.error, at };
      console.log(`LỖI: ${outcome.error}`);
    } else if (batch > 1) {
      const correct = Object.fromEntries(FIELDS.map((field) => [field, 0]));
      let missing = 0;
      for (const sample of unit) {
        const result = outcome.resultsById[sample.id];
        if (!result) {
          missing += 1;
          progress.results[sample.id] = { ok: false, hash: sampleHash(sample), error: "Gemini không trả kết quả hợp lệ cho mẫu này trong lô", at };
          continue;
        }
        progress.results[sample.id] = { ok: true, mode: "batch", batchSize: unit.length, hash: sampleHash(sample), latencyMs: outcome.latencyMs, result, at };
        for (const field of FIELDS) if (result[field] === sample[`expected_${field}`]) correct[field] += 1;
      }
      const got = unit.length - missing;
      console.log(
        `${FIELDS.map((field) => `${field} đúng ${correct[field]}/${got}`).join(", ")} (${outcome.latencyMs}ms)` +
          (missing ? ` — thiếu ${missing} mẫu, sẽ gọi lại lần sau` : "")
      );
    } else {
      const sample = unit[0];
      progress.results[sample.id] = { ok: true, mode: "single", hash: sampleHash(sample), latencyMs: outcome.latencyMs, result: outcome.result, at };
      console.log(`${markLine(sample, outcome.result)} (${outcome.latencyMs}ms)`);
    }
    progress.updatedAt = at;
    await writeJsonAtomic(paths.progress, progress); // lưu ngay để dừng giữa chừng không mất kết quả

    if (outcome.quota) {
      stoppedByQuota = true;
      break;
    }
    if (index < units.length - 1) await wait(DELAY_BETWEEN_CALLS_MS);
  }

  const stats = computeStats(testSet, progress.results);
  await writeFile(paths.report, buildReport({ testSet, testSetName, stats, resultsFile: basename(paths.results) }), "utf-8");
  await writeJsonAtomic(paths.results, stats.perSample);

  console.log("\n=== TÓM TẮT ===");
  console.log(`Đã đánh giá ${stats.evaluatedCount}/${testSet.length} mẫu.`);
  for (const field of FIELDS) {
    const n = stats.evaluatedCount;
    console.log(`${field}: ${n ? pct(stats.correct[field] / n) : "0.0%"} (${stats.correct[field]}/${n})`);
  }
  console.log(`Latency trung bình: ${stats.latency.avg}ms, p95: ${stats.latency.p95}ms`);
  if (stoppedByAuth) {
    console.log(
      "\nĐã dừng vì Gemini từ chối API key (key sai, copy thiếu, hoặc không phải key Gemini API). " +
        "Key Gemini API có dạng AIza...; key dạng AQ.... là key Google Cloud/Vertex AI, Gemini API không nhận. " +
        "Dùng key trong functions/.secret.local hoặc tạo tại https://aistudio.google.com/apikey rồi chạy lại đúng lệnh cũ."
    );
  } else if (stoppedByOverload) {
    console.log("\nĐã dừng vì máy chủ Gemini quá tải kéo dài. Tiến độ đã lưu — khoảng 15–30 phút sau chạy lại đúng lệnh cũ.");
  } else if (stoppedByQuota) {
    console.log("\nĐã dừng vì hết quota Gemini. Tiến độ đã lưu — để đến khi quota được cấp lại rồi chạy lại đúng lệnh cũ.");
  } else if (stats.evaluatedCount < testSet.length && !reportOnly) {
    console.log("\nChưa chạy hết tập test. Chạy lại đúng lệnh cũ để chạy tiếp từ chỗ dừng.");
  }
  console.log(`Đã ghi báo cáo vào ${basename(paths.report)}, kết quả từng mẫu vào ${basename(paths.results)}.`);
  return { stats, stoppedByQuota, stoppedByAuth, stoppedByOverload, paths };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !options.reportOnly) {
    console.error("Thiếu GEMINI_API_KEY. Chạy: GEMINI_API_KEY=xxxxx npm run eval");
    process.exit(1);
  }
  if (!options.reportOnly && /^x+$/i.test(apiKey)) {
    console.error('"xxxxx" chỉ là chỗ để điền — thay bằng API key Gemini thật của bạn (lấy tại https://aistudio.google.com/apikey).');
    process.exit(1);
  }
  const ai = options.reportOnly ? null : new GoogleGenAI({ apiKey });
  await runEvaluation({ ai, ...options });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Lỗi khi chạy đánh giá:", error);
    process.exit(1);
  });
}
