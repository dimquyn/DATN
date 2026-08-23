import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/*
 * Tránh khởi tạo Firebase App nhiều lần khi Expo Fast Refresh.
 */
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/*
 * Xác định host để kết nối Firebase Emulator:
 * - Web (chạy trên PC): 127.0.0.1 hoạt động bình thường.
 * - Native (Expo Go trên thiết bị thật/máy ảo): 127.0.0.1 trỏ về chính
 *   thiết bị đó, không phải PC đang chạy Emulator, nên cần lấy đúng IP LAN
 *   của PC. Constants.expoConfig?.hostUri chứa địa chỉ Metro Bundler mà
 *   thiết bị đã dùng để kết nối (vd "192.168.103.100:8081"), nên tách phần
 *   host ra là có ngay IP LAN đúng — không cần hard-code IP.
 */
function getEmulatorHost(): string {
  if (Platform.OS === "web") {
    return "127.0.0.1";
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];

  if (!host) {
    console.warn(
      "Không xác định được IP LAN từ Expo hostUri, dùng 127.0.0.1 (có thể không kết nối được Emulator trên thiết bị thật)."
    );
    return "127.0.0.1";
  }

  return host;
}

/*
 * Dùng globalThis thay vì biến module-scope thông thường để cờ này
 * không bị reset khi Expo Fast Refresh thay thế lại module trong lúc
 * phát triển — tránh gọi connectAuthEmulator/connectFirestoreEmulator
 * nhiều lần (Firebase sẽ throw nếu bị gọi lặp lại sau khi đã có request).
 */
declare global {
  // eslint-disable-next-line no-var
  var __FIREBASE_EMULATORS_CONNECTED__: boolean | undefined;
}

if (__DEV__ && !globalThis.__FIREBASE_EMULATORS_CONNECTED__) {
  const emulatorHost = getEmulatorHost();

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`);
  connectFirestoreEmulator(db, emulatorHost, 8080);

  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}