import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "../../../components/common/FullScreenLoading";
import { subscribeToTicketHistory } from "../../../services/ticket-history.service";
import {
  getTicketHistoryDotColor,
  getTicketHistoryLabel,
} from "../../../constants/ticket-history";
import { formatTicketDate } from "../../../utils/format-ticket-date";
import type { TicketHistoryEntry } from "../../../types/ticket-history";
import type { Timestamp } from "firebase/firestore";

function formatTimeOnly(value: Timestamp | null): string {
  if (!value) return "--:--";
  const date = value.toDate();
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function TicketHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entries, setEntries] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToTicketHistory(
      id,
      (nextEntries) => {
        setEntries(nextEntries);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Lỗi khi tải lịch sử ticket:", err);
        setError("Không thể tải lịch sử xử lý.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const ticketCode = entries.find((entry) => entry.ticketCode)?.ticketCode ?? "";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Lịch sử xử lý {ticketCode}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <FullScreenLoading message="Đang tải lịch sử..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Chưa có lịch sử xử lý nào.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {entries.map((entry, index) => (
            <View key={entry.id} style={styles.timelineRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{formatTimeOnly(entry.createdAt)}</Text>
              </View>

              <View style={styles.dotColumn}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: getTicketHistoryDotColor(entry.action) },
                  ]}
                />
                {index < entries.length - 1 && <View style={styles.connectorLine} />}
              </View>

              <View style={styles.contentColumn}>
                <Text style={styles.actionText}>{getTicketHistoryLabel(entry.action)}</Text>
                <Text style={styles.actorText}>{entry.actorName}</Text>
                <Text style={styles.dateText}>{formatTicketDate(entry.createdAt)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backButtonText: { fontSize: 20, color: "#111827" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginRight: 36,
  },
  headerSpacer: { width: 0 },
  scrollContent: { padding: 20 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: "#B91C1C", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  timelineRow: { flexDirection: "row" },
  timeColumn: { width: 48 },
  timeText: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  dotColumn: { width: 20, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  connectorLine: { flex: 1, width: 2, backgroundColor: "#E5E7EB", marginTop: 2 },
  contentColumn: { flex: 1, paddingBottom: 20 },
  actionText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  actorText: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  dateText: { marginTop: 2, fontSize: 11, color: "#9CA3AF" },
});