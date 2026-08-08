import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { getAuthErrorMessage } from "../utils/firebase-auth-error";
import { FullScreenLoading } from "../components/common/FullScreenLoading";
import { TicketCard } from "../components/cards/TicketCard";
import { subscribeToTickets } from "../services/ticket.service";
import type { Ticket } from "../types/ticket";

export default function DashboardScreen() {
  const { user, initializing, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToTickets(
      (nextTickets) => {
        setTickets(nextTickets);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách khiếu nại:", err);
        setError("Không thể tải danh sách khiếu nại.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;

    setLogoutError(null);
    setLoggingOut(true);

    try {
      await logout();
    } catch (err) {
      setLogoutError(getAuthErrorMessage(err));
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Danh sách khiếu nại</Text>
          <Text style={styles.subtitle}>
            Các yêu cầu từ khách hàng được cập nhật theo thời gian thực
          </Text>
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
      </View>

      {logoutError !== null && (
        <View style={styles.logoutErrorBox}>
          <Text style={styles.logoutErrorText}>{logoutError}</Text>
        </View>
      )}

      {loading ? (
        <FullScreenLoading message="Đang tải danh sách khiếu nại..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Không thể tải danh sách khiếu nại.</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TicketCard ticket={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>Chưa có khiếu nại nào</Text>
              <Text style={styles.emptySubtitle}>
                Các khiếu nại mới từ khách hàng sẽ xuất hiện tại đây.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTextBlock: { flex: 1, paddingRight: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  logoutButton: {
    height: 38,
    minWidth: 90,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  logoutButtonDisabled: { backgroundColor: "#F1A9A9" },
  logoutButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  logoutErrorBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutErrorText: { color: "#B91C1C", fontSize: 13 },
  listContent: { paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#B91C1C", textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151", textAlign: "center" },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: "#9CA3AF", textAlign: "center" },
});