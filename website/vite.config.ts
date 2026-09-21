import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true -> nghe trên 0.0.0.0 thay vì chỉ localhost, để mở được từ
  // điện thoại/máy khác cùng mạng LAN qua IP của máy chạy `npm run dev`.
  server: {
    host: true,
  },
})