# Đánh giá độ chính xác AI (functions/src/index.ts → analyzeTicketWithAI)

Script này chạy lại **đúng prompt** mà `analyzeTicketWithAI` dùng, trên một tập
khiếu nại đã gán nhãn sẵn (ground truth), rồi tính độ chính xác — dùng cho
chương "Đánh giá hệ thống" trong báo cáo đồ án.

## Chạy

```bash
cd eval
npm install
GEMINI_API_KEY=xxxxx npm run eval        # tập 20 mẫu: test-set.json
GEMINI_API_KEY=xxxxx npm run eval:500    # tập 500 mẫu: test-set-500.json
```

Dùng đúng API key bạn đang dùng cho `functions` (trong `functions/.secret.local`
hoặc secret đã set cho project thật). Mỗi mẫu mất khoảng 4 giây chờ cộng thời
gian Gemini trả lời, nên 500 mẫu chạy liền một lượt mất gần 2 giờ.

## Chạy nhiều lần, tiếp từ chỗ dừng

Kết quả từng mẫu được lưu **ngay sau mỗi lần gọi** vào file tiến độ
(`progress.json` cho tập 20 mẫu, `progress-500.json` cho tập 500 mẫu). Lỡ tắt
máy, mất mạng, bấm Ctrl+C hay hết quota thì chỉ cần **chạy lại đúng lệnh cũ**:
script bỏ qua các mẫu đã xong, chỉ gọi Gemini cho mẫu còn lại và mẫu bị lỗi ở
lần trước.

```bash
# Chia nhỏ: mỗi lần chỉ chạy 20 mẫu (hợp với quota miễn phí theo ngày)
GEMINI_API_KEY=xxxxx npm run eval:500 -- --limit 20

# Hôm sau chạy lại y hệt, tự tiếp từ mẫu thứ 21
GEMINI_API_KEY=xxxxx npm run eval:500 -- --limit 20

# Chỉ tạo lại báo cáo từ tiến độ đã có, không gọi Gemini (không cần API key)
npm run eval:500 -- --report-only

# Xóa tiến độ, chạy lại từ đầu (VD sau khi sửa prompt thật)
GEMINI_API_KEY=xxxxx npm run eval:500 -- --reset
```

- **Hết quota**: khi Gemini báo lỗi 429, script chờ khoảng 1 phút rồi thử lại
  (giới hạn theo phút). Thử 2 lần vẫn lỗi thì coi như hết quota trong ngày:
  script dừng, giữ nguyên tiến độ và in hướng dẫn chạy lại.
- **Chạy hết hạn mức trong ngày**: bỏ `--limit`, script chạy đến khi xong 500
  mẫu hoặc hết quota thì tự dừng. Quota theo ngày của Gemini được cấp lại lúc
  0h giờ Thái Bình Dương (khoảng 14h–15h giờ Việt Nam), sau giờ đó chạy lại.
- **Thứ tự chạy xen kẽ 5 nhóm**: mẫu được gọi lần lượt nhóm Gói cước, SIM,
  Đường truyền, Thanh toán, Khác rồi lặp lại, nên dù chưa chạy hết 500 mẫu thì
  phần đã chạy vẫn chia đều các nhóm.
- **Báo cáo từng phần**: sau mỗi lần chạy, `report*.md` được tạo lại từ tất cả
  mẫu đã xong, có ghi rõ "đã đánh giá X/500". Chỉ lấy số liệu đưa vào báo cáo
  đồ án khi đã đủ 500/500.
- **Sửa nhãn không cần chạy lại**: script chỉ lưu câu trả lời của Gemini, còn
  nhãn đúng luôn đọc từ tập test hiện tại. Sửa `expected_*` rồi chạy
  `--report-only` là có số liệu mới. Mẫu nào bị sửa `content`, `customerName`
  hoặc `channel` thì tự được gọi lại ở lần chạy sau.
- **Đổi độ trễ giữa 2 lần gọi**: mặc định 4000ms, đặt `EVAL_DELAY_MS=7000` nếu
  hay bị 429 theo phút ở gói miễn phí.

## Chạy đủ tập lớn trong quota miễn phí: chế độ theo lô

Gói miễn phí chỉ cho khoảng 20 lượt gọi/ngày, mỗi lượt 1 khiếu nại thì 500
mẫu mất gần một tháng. Với `--batch N`, mỗi lần gọi gộp N khiếu nại và Gemini
trả về mảng kết quả phân loại, nên 480 mẫu chỉ tốn 16 lượt gọi:

```bash
GEMINI_API_KEY=xxxxx npm run eval:500 -- --batch 30
```

- Giữ nguyên: model, vai trò nhân viên CSKH, 3 hướng dẫn phân loại và tập nhãn
  (enum) của `category`/`priority`/`sentiment`, lấy từ prompt và schema hệ thống.
- Khác với hệ thống thật: Gemini đọc nhiều khiếu nại trong 1 lần gọi và không
  sinh `summary`/`suggestion`/`reply`. Khi trình bày kết quả phải ghi rõ điều
  này; báo cáo tự ghi số mẫu của từng chế độ và tách độ chính xác theo chế độ.
- Độ trễ chỉ tính trên các lần gọi đơn lẻ (1 khiếu nại/lần, đúng như hệ thống).
- Mẫu nào Gemini bỏ sót trong lô thì ghi lỗi và được gọi lại ở lần chạy sau.
- Gemini báo 503 (quá tải): script chờ 30s, 60s, 2 phút, 4 phút rồi thử lại;
  vẫn quá tải thì dừng, giữ tiến độ — 15–30 phút sau chạy lại lệnh cũ.

Kết quả ghi ra (hậu tố `-500` cho tập 500 mẫu):
- `eval/report.md`, `eval/report-500.md`: báo cáo đọc được ngay, copy thẳng
  vào báo cáo đồ án.
- `eval/results.json`, `eval/results-500.json`: dữ liệu thô từng mẫu, kèm
  summary/suggestion/reply, dùng làm phụ lục nếu cần.

## Tập test

- `test-set.json`: 20 mẫu khởi điểm, phủ đều 5 category / 3 priority /
  4 sentiment.
- `test-set-500.json`: 500 mẫu (TS001–TS500), mỗi category 100 mẫu, có đủ
  kiểu viết (chuẩn, viết tắt, không dấu, dài, ngắn) và 75 ca khó nằm giữa hai
  nhóm. 18 mẫu đầu (TS001–TS018) là 18 mẫu dùng trong báo cáo. Ngoài các
  trường bắt buộc, mỗi mẫu có thêm `style`, `hard`, `note`, `source`; báo cáo
  dùng `style` và `hard` để tính độ chính xác theo kiểu viết và theo độ khó.

Format một mẫu (thêm mẫu mới theo đúng format này):

```json
{
  "id": "TS501",
  "customerName": "Tên khách hàng",
  "channel": "Website",
  "content": "Nội dung khiếu nại...",
  "expected_category": "Gói cước/Dữ liệu | SIM | Đường truyền | Thanh toán | Khác",
  "expected_priority": "High Priority | Medium | Low",
  "expected_sentiment": "Tích cực | Trung lập | Tiêu cực | Rất tiêu cực"
}
```

## Cách đọc báo cáo

- **Accuracy category/priority/sentiment**: % AI đoán đúng so với nhãn bạn
  gán — đây là số liệu chính để trích vào báo cáo (VD: "AI phân loại đúng
  85% trên tập 40 mẫu kiểm thử").
- **Ma trận nhầm lẫn (confusion matrix)**: hàng là nhãn đúng, cột là nhãn AI
  đoán — nhìn vào đây để chỉ ra AI hay nhầm nhóm nào với nhóm nào (phần này
  hay được đánh giá cao vì thể hiện phân tích sâu, không chỉ số phần trăm).
  Có cho cả 3 trường category, priority, sentiment.
- **Precision / Recall / F1 từng nhãn, Macro-F1**: precision là trong số mẫu
  AI gán nhãn X, bao nhiêu % đúng là X; recall là trong số mẫu đúng là X, AI
  bắt được bao nhiêu %; F1 dung hòa hai chỉ số. Macro-F1 là trung bình F1 các
  nhãn, không bị nhãn nhiều mẫu lấn át như accuracy.
- **Độ chính xác theo kiểu viết và độ khó**: AI có giữ được độ chính xác khi
  khách viết tắt, không dấu, hay với ca khó nằm giữa hai nhóm không.
- **Latency**: thời gian Gemini xử lý 1 khiếu nại — dùng cho phần phân tích
  phi chức năng (hiệu năng). p95 là mức mà 95% số lần gọi nhanh hơn hoặc bằng.

## Lưu ý

- `summary`/`suggestion`/`reply` là văn bản sinh ra (không phải phân loại)
  nên không tính được accuracy tự động — script vẫn lưu lại các giá trị này
  trong `results.json` để bạn (hoặc 1-2 người khác) tự chấm điểm theo thang
  1–5 (đúng trọng tâm / văn phong lịch sự / gửi thẳng được không cần sửa),
  rồi báo cáo điểm trung bình riêng.
- `buildPrompt`/`AI_RESPONSE_SCHEMA` trong `run-eval.mjs` được copy nguyên
  văn từ `functions/src/index.ts`. Nếu sau này sửa prompt thật, nhớ đồng bộ
  lại 2 khối này để kết quả đánh giá phản ánh đúng hệ thống đang chạy.
