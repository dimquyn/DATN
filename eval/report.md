# Báo cáo đánh giá độ chính xác AI phân tích khiếu nại

- Ngày chạy: 2026-09-22T13:45:57.203Z
- Model: gemini-2.5-flash
- Số mẫu trong tập test: 20
- Số mẫu đánh giá thành công: 15 (5 mẫu lỗi, xem results.json)

## Độ chính xác theo từng trường

| Trường | Đúng / Tổng | Accuracy |
| --- | --- | --- |
| category | 13/15 | 86.7% |
| priority | 12/15 | 80.0% |
| sentiment | 11/15 | 73.3% |

## Ma trận nhầm lẫn (category)

| Thực tế \ AI đoán | Gói cước/Dữ liệu | SIM | Đường truyền | Thanh toán | Khác |
| --- | --- | --- | --- | --- | --- |
| **Gói cước/Dữ liệu** | 3 | 0 | 0 | 0 | 0 |
| **SIM** | 0 | 2 | 1 | 0 | 0 |
| **Đường truyền** | 0 | 0 | 3 | 0 | 0 |
| **Thanh toán** | 0 | 0 | 0 | 3 | 0 |
| **Khác** | 1 | 0 | 0 | 0 | 2 |

## Độ trễ phân tích (thời gian gọi Gemini API)

- Trung bình: 8102ms
- p95: 17633ms
- Min/Max: 4693ms / 17633ms

## Chi tiết từng mẫu

| ID | Category | Priority | Sentiment |
| --- | --- | --- | --- |
| TS01 | ✓ | ✓ | ✗ (kỳ vọng Trung lập, AI: Tiêu cực) |
| TS02 | ✓ | ✓ | ✓ |
| TS03 | ✓ | ✓ | ✗ (kỳ vọng Tiêu cực, AI: Rất tiêu cực) |
| TS04 | ✓ | ✗ (kỳ vọng Medium, AI: High Priority) | ✓ |
| TS05 | ✓ | ✓ | ✓ |
| TS06 | ✓ | ✓ | ✓ |
| TS07 | ✗ (kỳ vọng SIM, AI: Đường truyền) | ✓ | ✓ |
| TS08 | ✓ | ✗ (kỳ vọng Medium, AI: High Priority) | ✓ |
| TS09 | ✓ | ✓ | ✗ (kỳ vọng Rất tiêu cực, AI: Tiêu cực) |
| TS10 | ✗ (kỳ vọng Khác, AI: Gói cước/Dữ liệu) | ✓ | ✓ |
| TS11 | ✓ | ✗ (kỳ vọng Medium, AI: High Priority) | ✓ |
| TS12 | ✓ | ✓ | ✓ |
| TS13 | ✓ | ✓ | ✓ |
| TS14 | ✓ | ✓ | ✓ |
| TS15 | ✓ | ✓ | ✗ (kỳ vọng Tiêu cực, AI: Trung lập) |