import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Khởi tạo Firebase Admin SDK — CẦN THIẾT cho analyzeTicketWithAI vì function này
// đọc/ghi Firestore (tickets, ai_results). testGemini không cần dòng này vì chỉ gọi Gemini.
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Khai báo "tham số bí mật" — giá trị thật lấy từ Cloud Secret Manager khi deploy,
// hoặc từ file .secret.local khi chạy Emulator. Dùng CHUNG cho cả 2 function.
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * HTTP Function kiểm thử kết nối tới Gemini API.
 * POST /testGemini
 * Body: { "text": "Xin chào" }
 * Trả về: { "reply": "..." }
 */
export const testGemini = onRequest(
  { secrets: [geminiApiKey], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Chỉ hỗ trợ phương thức POST." });
      return;
    }

    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Thiếu trường 'text' hoặc giá trị không hợp lệ." });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: text,
      });

      res.status(200).json({ reply: response.text });
    } catch (error) {
      console.error("Lỗi khi gọi Gemini API:", error);
      res.status(500).json({ error: "Không thể kết nối tới Gemini API." });
    }
  }
);

/**
 * ============================================================
 * Cloud Function: analyzeTicketWithAI
 * ============================================================
 * Firestore Trigger (onDocumentCreated) trên tickets/{ticketId}.
 * Tự động chạy khi có ticket mới -> gọi Gemini -> ghi ai_results
 * -> update tickets.status = "ai_analyzed". Lỗi ở bước nào cũng
 * KHÔNG đổi status, giữ nguyên "pending".
 * ============================================================
 */
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
    summary: {
      type: Type.STRING,
      description: "Tóm tắt ngắn gọn nội dung khiếu nại trong 1-2 câu",
    },
    suggestion: {
      type: Type.STRING,
      description: "Gợi ý hướng xử lý nội bộ dành cho nhân viên CSKH",
    },
    reply: {
      type: Type.STRING,
      description: "Mẫu phản hồi lịch sự, chuyên nghiệp có thể gửi thẳng cho khách hàng",
    },
  },
  required: ["category", "priority", "sentiment", "summary", "suggestion", "reply"],
};

interface AIAnalysisResult {
  category: "Gói cước/Dữ liệu" | "SIM" | "Đường truyền" | "Thanh toán" | "Khác";
  priority: "High Priority" | "Medium" | "Low";
  sentiment: "Tích cực" | "Trung lập" | "Tiêu cực" | "Rất tiêu cực";
  summary: string;
  suggestion: string;
  reply: string;
}

function buildPrompt(params: {
  customerName: string;
  content: string;
  channel: string;
}): string {
  const { customerName, content, channel } = params;

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

Chỉ trả về JSON, không thêm bất kỳ văn bản giải thích nào khác.`;
}

export const analyzeTicketWithAI = onDocumentCreated(
  {
    document: "tickets/{ticketId}",
    region: "asia-southeast1",
    secrets: [geminiApiKey],
  },
  async (event) => {
    const ticketId = event.params.ticketId;
    const snapshot = event.data;

    if (!snapshot) {
      logger.error(`[analyzeTicketWithAI] Không có dữ liệu snapshot cho ticket ${ticketId}`);
      return;
    }

    const ticketRef = db.collection("tickets").doc(ticketId);

    try {
      const ticketData = snapshot.data();
      const customerName: string = ticketData?.customerName ?? "Khách hàng";
      const content: string = ticketData?.content ?? "";
      const channel: string = ticketData?.channel ?? "Không xác định";

      if (!content.trim()) {
        logger.warn(`[analyzeTicketWithAI] Ticket ${ticketId} không có nội dung, bỏ qua phân tích AI`);
        return;
      }

      const prompt = buildPrompt({ customerName, content, channel });

      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
        },
      });

      const rawText = geminiResponse.text;

      if (!rawText) {
        throw new Error("Gemini trả về response rỗng");
      }

      let aiResult: AIAnalysisResult;
      try {
        aiResult = JSON.parse(rawText) as AIAnalysisResult;
      } catch (parseError) {
        logger.error(`[analyzeTicketWithAI] Lỗi parse JSON cho ticket ${ticketId}:`, rawText);
        throw new Error("Không parse được JSON từ Gemini");
      }

      const requiredFields: (keyof AIAnalysisResult)[] = [
        "category",
        "priority",
        "sentiment",
        "summary",
        "suggestion",
        "reply",
      ];
      const missingField = requiredFields.find((field) => !aiResult[field]);
      if (missingField) {
        throw new Error(`Kết quả AI thiếu field bắt buộc: ${missingField}`);
      }

      const aiResultRef = await db.collection("ai_results").add({
        ticketId,
        category: aiResult.category,
        priority: aiResult.priority,
        sentiment: aiResult.sentiment,
        summary: aiResult.summary,
        suggestion: aiResult.suggestion,
        reply: aiResult.reply,
        analyzedAt: FieldValue.serverTimestamp(),
      });

      await ticketRef.update({
        status: "ai_analyzed",
        aiResultId: aiResultRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`[analyzeTicketWithAI] Ticket ${ticketId} đã phân tích AI thành công -> aiResultId: ${aiResultRef.id}`);
    } catch (error) {
      logger.error(`[analyzeTicketWithAI] Lỗi khi xử lý ticket ${ticketId}:`, error);

      await ticketRef.update({
        updatedAt: FieldValue.serverTimestamp(),
        lastAIError: error instanceof Error ? error.message : "Unknown error",
      }).catch((updateError) => {
        logger.error(`[analyzeTicketWithAI] Không thể ghi lastAIError cho ticket ${ticketId}:`, updateError);
      });
    }
  }
);