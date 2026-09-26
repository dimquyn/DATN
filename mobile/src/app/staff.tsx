import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { FirebaseError } from "firebase/app";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { FullScreenLoading } from "../components/common/FullScreenLoading";
import {
  createStaffAccount,
  subscribeToStaffList,
  updateStaffAccount,
} from "../services/staff.service";
import type { StaffProfile, StaffRole } from "../types/staff";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cloud Function trả HttpsError kèm message tiếng Việt — hiển thị lại cho admin.
function getCallableErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError && error.message && !error.message.startsWith("internal")) {
    return error.message;
  }
  return fallback;
}

export default function StaffManagementScreen() {
  const { user, initializing, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [creating, setCreating] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // uid của tài khoản đang được cập nhật (khóa/mở khóa/đổi vai trò)
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ uid: string; message: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = subscribeToStaffList(
      (nextStaff) => {
        setStaffList(nextStaff);
        setLoading(false);
        setListError(null);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách nhân viên:", err);
        setListError("Không thể tải danh sách nhân viên.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Nhân viên thường không vào được màn này (rules cũng chặn đọc "staff").
  if (!isAdmin) {
    return <Redirect href="/profile" />;
  }

  const resetForm = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setRole("staff");
  };

  const handleCreate = async () => {
    if (creating) return;
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length === 0 || trimmedName.length > 100) {
      setFormError("Họ tên phải có từ 1 đến 100 ký tự.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 100) {
      setFormError("Email không đúng định dạng.");
      return;
    }
    if (password.length < 6 || password.length > 100) {
      setFormError("Mật khẩu phải có từ 6 đến 100 ký tự.");
      return;
    }

    setCreating(true);
    try {
      await createStaffAccount({ displayName: trimmedName, email: trimmedEmail, password, role });
      setFormSuccess(`Đã tạo tài khoản ${trimmedEmail}.`);
      resetForm();
    } catch (err) {
      console.error("Lỗi khi tạo tài khoản nhân viên:", err);
      setFormError(getCallableErrorMessage(err, "Không thể tạo tài khoản. Vui lòng thử lại."));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (staff: StaffProfile, changes: { role?: StaffRole; active?: boolean }) => {
    if (updatingUid) return;
    setUpdatingUid(staff.uid);
    setRowError(null);

    try {
      await updateStaffAccount({ uid: staff.uid, ...changes });
    } catch (err) {
      console.error("Lỗi khi cập nhật tài khoản nhân viên:", err);
      setRowError({
        uid: staff.uid,
        message: getCallableErrorMessage(err, "Không thể cập nhật tài khoản. Vui lòng thử lại."),
      });
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Quản lý nhân viên</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Pressable
            onPress={() => {
              setShowForm((prev) => !prev);
              setFormError(null);
              setFormSuccess(null);
            }}
          >
            <Text style={styles.toggleText}>
              {showForm ? "Ẩn form thêm nhân viên" : "+ Thêm tài khoản nhân viên"}
            </Text>
          </Pressable>

          {showForm && (
            <View style={styles.form}>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Họ tên"
                placeholderTextColor="#9CA3AF"
                editable={!creating}
                maxLength={100}
                style={styles.input}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email đăng nhập"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!creating}
                maxLength={100}
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mật khẩu ban đầu (tối thiểu 6 ký tự)"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                editable={!creating}
                maxLength={100}
                style={styles.input}
              />

              <View style={styles.roleRow}>
                {(["staff", "admin"] as StaffRole[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setRole(option)}
                    disabled={creating}
                    style={[styles.roleChip, role === option ? styles.roleChipActive : null]}
                  >
                    <Text
                      style={[styles.roleChipText, role === option ? styles.roleChipTextActive : null]}
                    >
                      {option === "admin" ? "Quản trị viên" : "Nhân viên"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {formError && <Text style={styles.errorText}>{formError}</Text>}
              {formSuccess && <Text style={styles.successText}>{formSuccess}</Text>}

              <Pressable
                onPress={handleCreate}
                disabled={creating}
                style={[styles.primaryButton, creating ? styles.buttonDisabled : null]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Tạo tài khoản</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color="#1667B1" />
        ) : listError ? (
          <Text style={styles.errorText}>{listError}</Text>
        ) : (
          staffList.map((staff) => {
            const isSelf = staff.uid === user.uid;
            const isUpdating = updatingUid === staff.uid;

            return (
              <View key={staff.uid} style={[styles.card, !staff.active ? styles.cardInactive : null]}>
                <View style={styles.staffHeader}>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>
                      {staff.displayName || staff.email}
                      {isSelf ? " (bạn)" : ""}
                    </Text>
                    <Text style={styles.staffEmail}>{staff.email}</Text>
                  </View>
                  <View style={styles.badges}>
                    <Text style={[styles.badge, staff.role === "admin" ? styles.badgeAdmin : styles.badgeStaff]}>
                      {staff.role === "admin" ? "Admin" : "Nhân viên"}
                    </Text>
                    <Text style={[styles.badge, staff.active ? styles.badgeActive : styles.badgeLocked]}>
                      {staff.active ? "Hoạt động" : "Đã khóa"}
                    </Text>
                  </View>
                </View>

                {/* Không cho tự khóa/tự hạ quyền chính mình (Cloud Function cũng chặn). */}
                {!isSelf && (
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() =>
                        handleUpdate(staff, { role: staff.role === "admin" ? "staff" : "admin" })
                      }
                      disabled={!!updatingUid}
                      style={[styles.outlineButton, updatingUid ? styles.buttonDisabled : null]}
                    >
                      <Text style={styles.outlineButtonText}>
                        {staff.role === "admin" ? "Bỏ quyền admin" : "Cấp quyền admin"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleUpdate(staff, { active: !staff.active })}
                      disabled={!!updatingUid}
                      style={[
                        styles.outlineButton,
                        staff.active ? styles.dangerButton : null,
                        updatingUid ? styles.buttonDisabled : null,
                      ]}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#1667B1" />
                      ) : (
                        <Text
                          style={[styles.outlineButtonText, staff.active ? styles.dangerButtonText : null]}
                        >
                          {staff.active ? "Khóa tài khoản" : "Mở khóa"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {rowError?.uid === staff.uid && <Text style={styles.errorText}>{rowError.message}</Text>}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  backButtonText: { fontSize: 20, color: "#111827" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827", marginLeft: 8 },
  headerSpacer: { width: 32 },
  content: { padding: 16, paddingBottom: 40 },
  loader: { marginTop: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },
  cardInactive: { opacity: 0.7 },
  toggleText: { fontSize: 14, fontWeight: "700", color: "#1667B1" },
  form: { marginTop: 14 },
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
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  roleChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  roleChipActive: { borderColor: "#1667B1", backgroundColor: "#EFF6FF" },
  roleChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  roleChipTextActive: { color: "#1667B1" },
  primaryButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: "#1667B1",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  errorText: { fontSize: 12, color: "#B91C1C", marginTop: 8, marginBottom: 4 },
  successText: { fontSize: 12, color: "#047857", marginBottom: 10 },
  staffHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  staffEmail: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  badges: { alignItems: "flex-end", gap: 4 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeAdmin: { backgroundColor: "#EDE9FE", color: "#6D28D9" },
  badgeStaff: { backgroundColor: "#EFF6FF", color: "#1D4ED8" },
  badgeActive: { backgroundColor: "#ECFDF5", color: "#047857" },
  badgeLocked: { backgroundColor: "#FEF2F2", color: "#B91C1C" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  outlineButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1667B1",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: { fontSize: 13, fontWeight: "700", color: "#1667B1" },
  dangerButton: { borderColor: "#DC2626" },
  dangerButtonText: { color: "#DC2626" },
});
