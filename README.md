
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
| React Native | 🚧 Đang phát triển |

---
## Tác giả
**Lý Thị Diễm Quỳnh**
Đồ án tốt nghiệp - Học viện Kỹ thuật Mật mã