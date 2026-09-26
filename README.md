
---
# AI Telecom Complaint Support System
Hệ thống hỗ trợ xử lý khiếu nại khách hàng bằng AI cho doanh nghiệp viễn thông.

---
## Kiến trúc hệ thống
```text
Website (React)
    │
    ▼
Firestore (tickets)
    │
    ▼
Cloud Functions
    │
    ▼
Gemini API
    │
    ▼
Firestore (ai_results)
    │
    ▼
Mobile App (React Native)
```
---
## Công nghệ sử dụng
### Website
- React 19
- TypeScript
- Vite
- Tailwind CSS

### Mobile
- React Native
- Expo
- TypeScript

### Backend
- Firebase Firestore
- Firebase Authentication
- Cloud Functions v2

### AI
- Gemini API
- @google/genai

---
## Chức năng
### Website
- Gửi khiếu nại
- Validate dữ liệu
- Lưu Firestore

### AI Pipeline
- Phân tích nội dung khiếu nại
- Phân loại khiếu nại
- Xác định mức độ ưu tiên
- Phân tích cảm xúc
- Gợi ý hướng xử lý
- Sinh phản hồi mẫu

### Mobile App
- Đăng nhập
- Danh sách khiếu nại
- Chi tiết khiếu nại
- Hiển thị kết quả AI
- Nhận xử lý
- Cập nhật trạng thái

---
## Cấu trúc dự án
```text
DATN
│
├── website/
├── mobile/
├── functions/
├── firestore.rules
├── firebase.json
└── README.md
```

---
## Chạy dự án
### Website
```bash
cd website
npm install
npm run dev
```

### Firebase Emulator
```bash
firebase emulators:start --only firestore,functions
```
// netstat -ano | findstr :8080 
// taskkill /PID ... /F

### Mobile
```bash
cd mobile
npm install
npx expo start
```

### Tài khoản & phân quyền nhân viên
Chỉ tài khoản có hồ sơ `staff/{uid}` (role `admin` hoặc `staff`, `active: true`) mới vào được app.
Sau khi Emulator đã chạy, tạo admin đầu tiên và cấp quyền cho các tài khoản đang có:
```bash
cd functions
npm run seed:staff
# hoặc tự chọn tài khoản admin:
npm run seed:staff -- --email admin@cskh.vn --password admin123 --name "Quản trị viên"
```
Đăng nhập app bằng tài khoản admin → tab **Cá nhân** → **Quản lý nhân viên** để thêm, cấp quyền admin hoặc khóa tài khoản nhân viên.

Muốn giữ dữ liệu Emulator giữa các lần chạy (không phải seed lại mỗi lần):
```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

### Giới hạn chống lạm dụng
- Cùng 1 số điện thoại phải chờ **30 giây** giữa 2 lần gửi khiếu nại (firestore.rules, collection `phone_cooldowns`).
- Phân tích AI tối đa **200 lượt/ngày** toàn hệ thống và **5 lượt/ngày/số điện thoại** (`functions/src/limits.ts`); vượt hạn mức thì ticket được ghi `lastAIError` để nhân viên xử lý thủ công.
- Tra cứu/đánh giá sai quá **10 lần trong 15 phút** thì IP bị khóa tạm thời.
- Ticket đã đóng quá **365 ngày** được tự động ẩn danh họ tên, số điện thoại, email (`anonymizeOldTickets`, chạy 02:00 hằng ngày — cần gói Blaze, không chạy trên Emulator).

### Kiểm thử tự động
```bash
cd tests
npm install
npm test          # firestore.rules + hàm giới hạn/ẩn danh (Firestore Emulator)
npm run test:e2e  # phân quyền + Cloud Functions (Auth, Firestore, Functions Emulator)
```
Lưu ý: tắt `firebase emulators:start` đang chạy trước khi chạy test (trùng cổng).

---
## Tài liệu
### Thiết kế giao diện
> Visily
Link: https://app.visily.ai/projects/1ac579ce-45f9-433c-9454-660710ef1c0b/boards/2642281

### Sơ đồ hệ thống
> Draw.io
Link: https://drive.google.com/file/d/1vxjmFwTVQcZeqO1kkqBTA9GU1ycTZ_te/view?usp=sharing

---
## Tiến độ
| Module | Trạng thái |
|---------|-----------|
| Website | ✅ Hoàn thành |
| Firebase | ✅ Hoàn thành |
| AI Pipeline | ✅ Hoàn thành |
| React Native | ✅ Hoàn thành chức năng chính |

---
## Tác giả
**Lý Thị Diễm Quỳnh**
Đồ án tốt nghiệp - Học viện Kỹ thuật Mật mã
