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

export function getChangePasswordErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Mật khẩu hiện tại không đúng.";
      case "auth/weak-password":
        return "Mật khẩu mới quá yếu (tối thiểu 6 ký tự).";
      case "auth/requires-recent-login":
        return "Phiên đăng nhập đã cũ. Vui lòng đăng xuất, đăng nhập lại rồi thử tiếp.";
      case "auth/too-many-requests":
        return "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.";
      case "auth/network-request-failed":
        return "Không thể kết nối tới hệ thống xác thực.";
      default:
        return "Đổi mật khẩu không thành công. Vui lòng thử lại.";
    }
  }

  return "Đổi mật khẩu không thành công. Vui lòng thử lại.";
}