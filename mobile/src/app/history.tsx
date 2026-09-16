import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { subscribeToHistoryFeed } from "../../services/ticket-history.service";
import {
  getTicketHistoryDotColor,
  getTicketHistoryLabel,
} from "../../constants/ticket-history";
import { formatRelativeTicketTime } from "../../utils/format-ticket-date";
import type { TicketHistoryEntry } from "../../types/ticket-history";

export default function HistoryFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToHistoryFeed(
      (nextEntries) => {
        setEntries(nextEntries);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Lỗi khi tải lịch sử xử lý:", err);
        setError("Không thể tải lịch sử xử lý.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Lịch sử xử lý</Text>
        <Text style={styles.subtitle}>Hoạt động gần đây trên mọi ticket</Text>
      </View>

      {loading ? (
        <FullScreenLoading message="Đang tải lịch sử..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/ticket/history/${item.ticketId}`)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <View
                style={[styles.dot, { backgroundColor: getTicketHistoryDotColor(item.action) }]}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowAction}>{getTicketHistoryLabel(item.action)}</Text>
                <Text style={styles.rowMeta}>
                  {item.ticketCode ?? "—"} · {item.actorName}
                </Text>
              </View>
              <Text style={styles.rowTime}>{formatRelativeTicketTime(item.createdAt)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>Chưa có hoạt động nào</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowPressed: { backgroundColor: "#F9FAFB" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  rowBody: { flex: 1 },
  rowAction: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowMeta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  rowTime: { fontSize: 11, color: "#9CA3AF" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#B91C1C", textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151", textAlign: "center" },
});