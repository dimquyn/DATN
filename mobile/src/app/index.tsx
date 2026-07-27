import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { FullScreenLoading } from "../components/common/FullScreenLoading";

export default function IndexScreen() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  return <Redirect href="/login" />;
}