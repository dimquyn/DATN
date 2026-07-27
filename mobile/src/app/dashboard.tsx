import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { getAuthErrorMessage } from "../utils/firebase-auth-error";
import { FullScreenLoading } from "../components/common/FullScreenLoading";

export default function DashboardScreen() {
  const { user, initializing, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) {
      return;
    }

    setLogoutError(null);
    setLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      setLogoutError(getAuthErrorMessage(error));
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Tổng quan công việc</Text>
        <Text style={styles.greeting}>Xin chào, nhân viên CSKH</Text>
        <Text style={styles.email}>{user.email}</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusText}>Đăng nhập thành công</Text>
        </View>

        {logoutError !== null && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{logoutError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          style={[
            styles.logoutButton,
            loggingOut ? styles.logoutButtonDisabled : null,
          ]}
        >
          {loggingOut ? (
            <View style={styles.logoutLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.logoutButtonText}>Đang đăng xuất...</Text>
            </View>
          ) : (
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  content: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  greeting: {
    marginTop: 10,
    fontSize: 15,
    color: "#374151",
    textAlign: "center",
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  statusCard: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  statusText: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    marginTop: 16,
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
  },
  logoutButton: {
    marginTop: 24,
    width: "100%",
    height: 46,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonDisabled: {
    backgroundColor: "#F1A9A9",
  },
  logoutLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});