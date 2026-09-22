import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { changePassword } from "../../services/auth.service";
import { getChangePasswordErrorMessage } from "../../utils/firebase-auth-error";
import { subscribeToTickets } from "../../services/ticket.service";
import type { Ticket } from "../../types/ticket";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToTickets(
      (nextTickets) => setTickets(nextTickets),
      (err) => console.error("Lỗi khi tải thống kê cá nhân:", err)
    );

    return () => unsubscribe();
  }, []);

  const myStats = useMemo(() => {
    if (!user) return { inProgress: 0, done: 0 };

    let inProgress = 0;
    let done = 0;

    for (const ticket of tickets) {
      if (ticket.assignedTo !== user.uid) continue;
      if (ticket.status === "in_progress") inProgress += 1;
      else if (ticket.status === "responded" || ticket.status === "closed") done += 1;
    }

    return { inProgress, done };
  }, [tickets, user]);

  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<boolean>(false);

  if (!user) {
    return null;
  }

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    setChangePasswordError(null);
    setChangePasswordSuccess(false);

    if (newPassword.length < 6) {
      setChangePasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setChangePasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setChangePasswordError(getChangePasswordErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const displayName = user.displayName?.trim() || "Chưa cập nhật họ tên";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >
      <View style={styles.card}>
        <View style={styles.avatarWrapper}>
          <Text style={styles.avatarGlyph}>👤</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.uid}>ID: {user.uid}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thống kê cá nhân</Text>
        <View style={styles.statRow}>
          <Pressable
            style={styles.statItem}
            onPress={() =>
              router.push({ pathname: "/tickets", params: { filter: "in_progress", mine: "1" } })
            }
          >
            <Text style={styles.statValue}>{myStats.inProgress}</Text>
            <Text style={styles.statLabel}>Đang xử lý</Text>
          </Pressable>
          <Pressable
            style={styles.statItem}
            onPress={() =>
              router.push({ pathname: "/tickets", params: { filter: "closed", mine: "1" } })
            }
          >
            <Text style={[styles.statValue, { color: "#047857" }]}>{myStats.done}</Text>
            <Text style={styles.statLabel}>Đã hoàn thành</Text>
          </Pressable>
        </View>
        <Text style={styles.processedText}>
          Tổng số ticket đã xử lý: <Text style={styles.processedValue}>{myStats.done}</Text>
        </Text>
      </View>

      <View style={styles.card}>
        <Pressable
          onPress={() => {
            setShowChangePassword((prev) => !prev);
            setChangePasswordError(null);
            setChangePasswordSuccess(false);
          }}
          style={styles.changePasswordToggle}
        >
          <Text style={styles.changePasswordToggleText}>
            {showChangePassword ? "Ẩn đổi mật khẩu" : "Đổi mật khẩu"}
          </Text>
        </Pressable>

        {showChangePassword && (
          <View style={styles.changePasswordForm}>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Mật khẩu hiện tại"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!changingPassword}
              style={styles.input}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mật khẩu mới"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!changingPassword}
              style={styles.input}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Xác nhận mật khẩu mới"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!changingPassword}
              style={styles.input}
            />

            {changePasswordError && (
              <Text style={styles.errorText}>{changePasswordError}</Text>
            )}
            {changePasswordSuccess && (
              <Text style={styles.successText}>Đổi mật khẩu thành công.</Text>
            )}

            <Pressable
              onPress={handleChangePassword}
              disabled={changingPassword}
              style={[styles.submitButton, changingPassword ? styles.submitButtonDisabled : null]}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Xác nhận đổi mật khẩu</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={[styles.logoutButton, loggingOut ? styles.logoutButtonDisabled : null]}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarGlyph: { fontSize: 30 },
  name: { fontSize: 17, fontWeight: "700", color: "#111827" },
  email: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  uid: { marginTop: 4, fontSize: 11, color: "#9CA3AF" },
  sectionTitle: { alignSelf: "flex-start", fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 14 },
  statRow: { flexDirection: "row", width: "100%", gap: 12 },
  statItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    paddingVertical: 16,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#C2410C" },
  statLabel: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  processedText: { marginTop: 14, fontSize: 13, color: "#374151", alignSelf: "flex-start" },
  processedValue: { fontWeight: "700", color: "#111827" },
  changePasswordToggle: { alignSelf: "flex-start" },
  changePasswordToggleText: { fontSize: 14, fontWeight: "700", color: "#1667B1" },
  changePasswordForm: { marginTop: 16, width: "100%" },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  errorText: { fontSize: 12, color: "#B91C1C", marginBottom: 10 },
  successText: { fontSize: 12, color: "#047857", marginBottom: 10 },
  submitButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: "#1667B1",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  logoutButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutButtonDisabled: { backgroundColor: "#F1A9A9" },
  logoutButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
