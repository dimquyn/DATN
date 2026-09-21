# Đánh giá độ chính xác AI (functions/src/index.ts → analyzeTicketWithAI)

Script này chạy lại **đúng prompt** mà `analyzeTicketWithAI` dùng, trên một tập
khiếu nại đã gán nhãn sẵn (ground truth), rồi tính độ chính xác — dùng cho
chương "Đánh giá hệ thống" trong báo cáo đồ án.

## Chạy

```bash
cd eval
npm install
GEMINI_API_KEY=xxxxx npm run eval
```

Dùng đúng API key bạn đang dùng cho `functions` (trong `functions/.secret.local`
hoặc secret đã set cho project thật). Chạy mất khoảng `4 giây × số mẫu` do có
delay giữa các lần gọi để né rate limit của gói miễn phí Gemini.

Kết quả ghi ra:
- `eval/report.md` — báo cáo đọc được ngay, copy thẳng vào báo cáo đồ án.
- `eval/results.json` — dữ liệu thô từng mẫu, dùng làm phụ lục nếu cần.

## Mở rộng tập test

`test-set.json` hiện có **20 mẫu khởi điểm**, phủ đều 5 category / 3 priority /
4 sentiment. Để số liệu có sức thuyết phục hơn khi bảo vệ, nên mở rộng lên
**40–50 mẫu** — thêm mẫu mới vào `test-set.json` theo đúng format:

```json
{
  "id": "TS21",
  "customerName": "Tên khách hàng",
  "channel": "Website",
  "content": "Nội dung khiếu nại...",
  "expected_category": "Gói cước/Dữ liệu | SIM | Đường truyền | Thanh toán | Khác",
  "expected_priority": "High Priority | Medium | Low",
  "expected_sentiment": "Tích cực | Trung lập | Tiêu cực | Rất tiêu cực"
}
```

Mẹo lấy mẫu thật thay vì tự viết: copy `content` từ vài ticket bạn đã tạo lúc
test hệ thống (qua web hoặc Firestore), tự gán nhãn đúng theo góc nhìn của
một nhân viên CSKH.

## Cách đọc báo cáo

- **Accuracy category/priority/sentiment**: % AI đoán đúng so với nhãn bạn
  gán — đây là số liệu chính để trích vào báo cáo (VD: "AI phân loại đúng
  85% trên tập 40 mẫu kiểm thử").
- **Ma trận nhầm lẫn (confusion matrix)**: hàng là nhãn đúng, cột là nhãn AI
  đoán — nhìn vào đây để chỉ ra AI hay nhầm nhóm nào với nhóm nào (phần này
  hay được đánh giá cao vì thể hiện phân tích sâu, không chỉ số phần trăm).
- **Latency**: thời gian Gemini xử lý 1 khiếu nại — dùng cho phần phân tích
  phi chức năng (hiệu năng).

## Lưu ý

- `summary`/`suggestion`/`reply` là văn bản sinh ra (không phải phân loại)
  nên không tính được accuracy tự động — script vẫn lưu lại các giá trị này
  trong `results.json` để bạn (hoặc 1-2 người khác) tự chấm điểm theo thang
  1–5 (đúng trọng tâm / văn phong lịch sự / gửi thẳng được không cần sửa),
  rồi báo cáo điểm trung bình riêng.
- `buildPrompt`/`AI_RESPONSE_SCHEMA` trong `run-eval.mjs` được copy nguyên
  văn từ `functions/src/index.ts`. Nếu sau này sửa prompt thật, nhớ đồng bộ
  lại 2 khối này để kết quả đánh giá phản ánh đúng hệ thống đang chạy.
