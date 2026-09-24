// Script đánh giá độ chính xác của Gemini trên tập dữ liệu khiếu nại có gán
// nhãn sẵn (ground truth) — dùng cho chương "Đánh giá hệ thống" trong báo cáo.
//
// Cách chạy:
//   cd eval
//   npm install
//   GEMINI_API_KEY=xxxxx npm run eval
//
// Kết quả ghi ra eval/report.md (đọc được ngay) và eval/results.json (dữ
// liệu thô, dùng làm phụ lục nếu cần).

import { readFile, writeFile } from "node:fs/promises";
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const TEST_SET_PATH = process.argv[2] ?? new URL("./test-set.json", import.meta.url);
const DELAY_BETWEEN_CALLS_MS = 4000; // né rate limit free tier của Gemini
const MAX_RETRIES = 2;

if (!API_KEY) {
  console.error("Thiếu GEMINI_API_KEY. Chạy: GEMINI_API_KEY=xxxxx npm run eval");
  process.exit(1);
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeOne(ai, sample) {
  const prompt = buildPrompt(sample);
  const startedAt = Date.now();

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
        },
      });

      const latencyMs = Date.now() - startedAt;
      const parsed = JSON.parse(response.text);
      return { ok: true, latencyMs, result: parsed };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(DELAY_BETWEEN_CALLS_MS * 2);
      }
    }
  }

  return { ok: false, error: lastError instanceof Error ? lastError.message : String(lastError) };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(index, 0)];
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

async function main() {
  const raw = await readFile(TEST_SET_PATH, "utf-8");
  const testSet = JSON.parse(raw);

  console.log(`Đang chạy đánh giá trên ${testSet.length} mẫu (mỗi mẫu cách nhau ${DELAY_BETWEEN_CALLS_MS}ms)...\n`);

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const perSampleResults = [];
  const correctCounts = { category: 0, priority: 0, sentiment: 0 };
  let evaluatedCount = 0;
  const latencies = [];

  const categoryLabels = AI_RESPONSE_SCHEMA.properties.category.enum;
  const confusionMatrix = Object.fromEntries(
    categoryLabels.map((label) => [label, Object.fromEntries(categoryLabels.map((l) => [l, 0]))])
  );

  for (const [index, sample] of testSet.entries()) {
    process.stdout.write(`[${index + 1}/${testSet.length}] ${sample.id} ... `);

    const outcome = await analyzeOne(ai, sample);

    if (!outcome.ok) {
      console.log(`LỖI: ${outcome.error}`);
      perSampleResults.push({ id: sample.id, error: outcome.error });
      await sleep(DELAY_BETWEEN_CALLS_MS);
      continue;
    }

    evaluatedCount += 1;
    latencies.push(outcome.latencyMs);

    const fieldMatches = {};
    for (const field of FIELDS) {
      const expected = sample[`expected_${field}`];
      const actual = outcome.result[field];
      const match = expected === actual;
      fieldMatches[field] = match;
      if (match) correctCounts[field] += 1;
    }

    if (confusionMatrix[sample.expected_category] && outcome.result.category in confusionMatrix[sample.expected_category]) {
      confusionMatrix[sample.expected_category][outcome.result.category] += 1;
    }

    console.log(
      `${fieldMatches.category ? "✓" : "✗"} category, ${fieldMatches.priority ? "✓" : "✗"} priority, ${
        fieldMatches.sentiment ? "✓" : "✗"
      } sentiment (${outcome.latencyMs}ms)`
    );

    perSampleResults.push({
      id: sample.id,
      content: sample.content,
      expected: {
        category: sample.expected_category,
        priority: sample.expected_priority,
        sentiment: sample.expected_sentiment,
      },
      actual: {
        category: outcome.result.category,
        priority: outcome.result.priority,
        sentiment: outcome.result.sentiment,
      },
      match: fieldMatches,
      latencyMs: outcome.latencyMs,
      reply: outcome.result.reply,
      suggestion: outcome.result.suggestion,
    });

    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p95Latency = Math.round(percentile(sortedLatencies, 95));

  const accuracyTable = FIELDS.map((field) => ({
    field,
    correct: correctCounts[field],
    total: evaluatedCount,
    accuracy: evaluatedCount ? ((correctCounts[field] / evaluatedCount) * 100).toFixed(1) : "0.0",
  }));

  const reportLines = [
    "# Báo cáo đánh giá độ chính xác AI phân tích khiếu nại",
    "",
    `- Ngày chạy: ${new Date().toISOString()}`,
    `- Model: gemini-2.5-flash`,
    `- Số mẫu trong tập test: ${testSet.length}`,
    `- Số mẫu đánh giá thành công: ${evaluatedCount}${evaluatedCount < testSet.length ? ` (${testSet.length - evaluatedCount} mẫu lỗi, xem results.json)` : ""}`,
    "",
    "## Độ chính xác theo từng trường",
    "",
    "| Trường | Đúng / Tổng | Accuracy |",
    "| --- | --- | --- |",
    ...accuracyTable.map((row) => `| ${row.field} | ${row.correct}/${row.total} | ${row.accuracy}% |`),
    "",
    "## Ma trận nhầm lẫn (category)",
    "",
    buildConfusionMatrixMarkdown(confusionMatrix, categoryLabels),
    "",
    "## Độ trễ phân tích (thời gian gọi Gemini API)",
    "",
    `- Trung bình: ${avgLatency}ms`,
    `- p95: ${p95Latency}ms`,
    `- Min/Max: ${sortedLatencies[0] ?? 0}ms / ${sortedLatencies[sortedLatencies.length - 1] ?? 0}ms`,
    "",
    "## Chi tiết từng mẫu",
    "",
    "| ID | Category | Priority | Sentiment |",
    "| --- | --- | --- | --- |",
    ...perSampleResults
      .filter((r) => !r.error)
      .map(
        (r) =>
          `| ${r.id} | ${r.match.category ? "✓" : `✗ (kỳ vọng ${r.expected.category}, AI: ${r.actual.category})`} | ${
            r.match.priority ? "✓" : `✗ (kỳ vọng ${r.expected.priority}, AI: ${r.actual.priority})`
          } | ${r.match.sentiment ? "✓" : `✗ (kỳ vọng ${r.expected.sentiment}, AI: ${r.actual.sentiment})`} |`
      ),
  ];

  await writeFile(new URL("./report.md", import.meta.url), reportLines.join("\n"), "utf-8");
  await writeFile(new URL("./results.json", import.meta.url), JSON.stringify(perSampleResults, null, 2), "utf-8");

  console.log("\n=== TÓM TẮT ===");
  for (const row of accuracyTable) {
    console.log(`${row.field}: ${row.accuracy}% (${row.correct}/${row.total})`);
  }
  console.log(`Latency trung bình: ${avgLatency}ms, p95: ${p95Latency}ms`);
  console.log("\nĐã ghi báo cáo đầy đủ vào eval/report.md và eval/results.json");
}

main().catch((error) => {
  console.error("Lỗi khi chạy đánh giá:", error);
  process.exit(1);
});
