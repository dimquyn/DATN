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
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);

  globalThis.__FIREBASE_EMULATORS_CONNECTED__ = true;
}