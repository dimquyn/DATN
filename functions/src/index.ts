import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// Khai báo "tham số bí mật" — giá trị thật lấy từ Cloud Secret Manager khi deploy,
// hoặc từ file .secret.local khi chạy Emulator.
const geminiApiKey = defineSecret("GEMINI_API_KEY");

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

Lưu ý khi soạn "reply": khách hàng đã cung cấp đầy đủ thông tin liên hệ (họ tên, số điện thoại, email) ngay khi gửi khiếu nại, hệ thống đã lưu lại đầy đủ. Không yêu cầu khách cung cấp lại số điện thoại, mã số thuê bao hay bất kỳ thông tin liên hệ nào đã có sẵn.

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

      // Không return im lặng: ném lỗi để khối catch ghi lastAIError, nhờ đó
      // ticket không kẹt mãi ở "pending" — nhân viên vẫn "Nhận xử lý" và tự
      // soạn phản hồi thủ công được như các trường hợp AI lỗi khác.
      if (!content.trim()) {
        throw new Error("Ticket không có nội dung khiếu nại để phân tích");
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
        // Lưu kèm priority ngay trên ticket (denormalize) để mobile hiển thị
        // badge độ ưu tiên ở danh sách ticket mà không cần đọc thêm ai_results.
        priority: aiResult.priority,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await ticketRef.collection("history").add({
        ticketId,
        ticketCode: ticketData?.code ?? null,
        action: "ai_analyzed",
        actorName: "Hệ thống AI",
        createdAt: FieldValue.serverTimestamp(),
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

/**
 * ============================================================
 * Cloud Function: trackTicket
 * ============================================================
 * Callable Function cho website (khách hàng KHÔNG đăng nhập) tra cứu
 * trạng thái khiếu nại của mình bằng mã ticket + số điện thoại đã đăng ký.
 * Dùng Admin SDK (bỏ qua Firestore rules) vì rules hiện tại chỉ cho phép
 * nhân viên đã đăng nhập đọc collection "tickets".
 * ============================================================
 */
export const trackTicket = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const { code, phone } = (request.data ?? {}) as { code?: unknown; phone?: unknown };

    if (typeof code !== "string" || !code.trim() || typeof phone !== "string" || !phone.trim()) {
      throw new HttpsError("invalid-argument", "Thiếu mã khiếu nại hoặc số điện thoại.");
    }

    const normalizedCode = code.trim().toUpperCase();

    const snapshot = await db
      .collection("tickets")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];

    // Không phân biệt "sai mã" hay "sai số điện thoại" trong thông báo lỗi —
    // tránh lộ thông tin cho việc dò mã ticket của người khác.
    if (!doc || doc.data().phone !== phone) {
      throw new HttpsError("not-found", "Không tìm thấy khiếu nại phù hợp.");
    }

    const data = doc.data();

    return {
      ticket: {
        code: data.code ?? normalizedCode,
        status: data.status,
        createdAt: data.createdAt?.toMillis?.() ?? null,
        updatedAt: data.updatedAt?.toMillis?.() ?? null,
        finalReply: data.finalReply ?? null,
        rating: data.rating ?? null,
        ratingComment: data.ratingComment ?? null,
      },
    };
  }
);

/**
 * ============================================================
 * Cloud Function: submitTicketRating
 * ============================================================
 * Callable Function cho website — khách hàng gửi đánh giá 1-5 sao + nhận
 * xét sau khi đã nhận phản hồi (tickets.finalReply != null). Chỉ chấp
 * nhận đánh giá đầu tiên cho mỗi ticket (không cho sửa/ghi đè).
 * ============================================================
 */
export const submitTicketRating = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    const { code, phone, rating, comment } = (request.data ?? {}) as {
      code?: unknown;
      phone?: unknown;
      rating?: unknown;
      comment?: unknown;
    };

    if (typeof code !== "string" || !code.trim() || typeof phone !== "string" || !phone.trim()) {
      throw new HttpsError("invalid-argument", "Thiếu mã khiếu nại hoặc số điện thoại.");
    }

    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpsError("invalid-argument", "Số sao đánh giá phải là số nguyên từ 1 đến 5.");
    }

    const normalizedComment = typeof comment === "string" ? comment.trim().slice(0, 500) : "";
    const normalizedCode = code.trim().toUpperCase();

    // Đọc-kiểm tra-ghi phải nằm chung 1 transaction — nếu tách rời (đọc rồi
    // mới update như trước) thì 2 lần bấm gửi đánh giá liên tiếp thật nhanh
    // (double-tap, mạng lag rồi bấm lại) có thể cùng lúc pass qua bước kiểm
    // tra "chưa đánh giá" trước khi bước ghi kịp chạy, dẫn tới ghi đè lẫn
    // nhau + tạo 2 dòng lịch sử "rated" trùng lặp cho cùng 1 ticket.
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(
        db.collection("tickets").where("code", "==", normalizedCode).limit(1)
      );

      const doc = snapshot.docs[0];

      if (!doc || doc.data().phone !== phone) {
        throw new HttpsError("not-found", "Không tìm thấy khiếu nại phù hợp.");
      }

      const data = doc.data();

      if (!data.finalReply) {
        throw new HttpsError("failed-precondition", "Khiếu nại chưa được phản hồi, chưa thể đánh giá.");
      }

      if (data.rating != null) {
        throw new HttpsError("already-exists", "Khiếu nại này đã được đánh giá trước đó.");
      }

      transaction.update(doc.ref, {
        rating,
        ratingComment: normalizedComment || null,
        ratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(doc.ref.collection("history").doc(), {
        ticketId: doc.id,
        ticketCode: data.code ?? normalizedCode,
        action: "rated",
        actorName: data.customerName ?? "Khách hàng",
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);