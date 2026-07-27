import { FirebaseError } from "firebase/app";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "Email không đúng định dạng.";
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Email hoặc mật khẩu không chính xác.";
      case "auth/user-disabled":
        return "Tài khoản này đã bị vô hiệu hóa.";
      case "auth/too-many-requests":
        return "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.";
      case "auth/network-request-failed":
        return "Không thể kết nối tới hệ thống xác thực.";
      default:
        return "Đăng nhập không thành công. Vui lòng thử lại.";
    }
  }

  return "Đăng nhập không thành công. Vui lòng thử lại.";
}