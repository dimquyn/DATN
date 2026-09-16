import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTickets } from "../../services/ticket.service";
import type { Ticket } from "../../types/ticket";

const NEW_STATUSES = new Set(["pending", "ai_analyzed"]);
const DONE_STATUSES = new Set(["responded", "closed"]);

const PRIORITY_ROWS: { key: "High Priority" | "Medium" | "Low"; label: string; dotColor: string }[] = [
  { key: "High Priority", label: "Cao", dotColor: "#EF4444" },
  { key: "Medium", label: "Trung bình", dotColor: "#F97316" },
  { key: "Low", label: "Thấp", dotColor: "#6366F1" },
];

function formatToday(): string {
  const now = new Date();
  return `Hôm nay, ${now.toLocaleDateString("vi-VN")}`;
}

export default function OverviewScreen() {
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTickets(
      (nextTickets) => {
        setTickets(nextTickets);
        setUpdatedAt(new Date());
      },
      (err) => console.error("Lỗi khi tải thống kê tổng quan:", err)
    );

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    let newCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;
    const priorityCount: Record<string, number> = { "High Priority": 0, Medium: 0, Low: 0 };

    for (const ticket of tickets) {
      if (NEW_STATUSES.has(ticket.status)) newCount += 1;
      else if (ticket.status === "in_progress") inProgressCount += 1;
      else if (DONE_STATUSES.has(ticket.status)) doneCount += 1;

      if (ticket.priority && ticket.priority in priorityCount) {
        priorityCount[ticket.priority] += 1;
      }
    }

    return { newCount, inProgressCount, doneCount, priorityCount };
  }, [tickets]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >
      <Text style={styles.title}>Tổng quan công việc</Text>
      <Text style={styles.subtitle}>{formatToday()}</Text>

      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: "#EEF2FF" }]}>
          <Text style={styles.statLabel}>TICKET MỚI</Text>
          <Text style={[styles.statValue, { color: "#4338CA" }]}>{stats.newCount}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FFF1E8" }]}>
          <Text style={styles.statLabel}>ĐANG XỬ LÝ</Text>
          <Text style={[styles.statValue, { color: "#C2410C" }]}>
            {String(stats.inProgressCount).padStart(2, "0")}
          </Text>
        </View>
      </View>

      <View style={[styles.statCard, styles.statCardWide, { backgroundColor: "#ECFDF5" }]}>
        <Text style={styles.statLabel}>ĐÃ HOÀN THÀNH</Text>
        <Text style={[styles.statValue, { color: "#047857" }]}>
          {String(stats.doneCount).padStart(2, "0")}
        </Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Mức độ ưu tiên</Text>
        {updatedAt && (
          <Text style={styles.sectionUpdatedText}>
            Cập nhật lúc{" "}
            {updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>

      <View style={styles.priorityList}>
        {PRIORITY_ROWS.map((row) => (
          <View key={row.key} style={styles.priorityRow}>
            <View style={styles.priorityRowLeft}>
              <View style={[styles.priorityDot, { backgroundColor: row.dotColor }]} />
              <Text style={styles.priorityLabel}>{row.label}</Text>
            </View>
            <Text style={styles.priorityValue}>{stats.priorityCount[row.key]}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  statRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  statCard: { flex: 1, borderRadius: 16, padding: 16 },
  statCardWide: { marginTop: 12 },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", letterSpacing: 0.4 },
  statValue: { marginTop: 10, fontSize: 28, fontWeight: "800" },
  sectionHeaderRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  sectionUpdatedText: { fontSize: 11, color: "#9CA3AF" },
  priorityList: { marginTop: 12, gap: 10 },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  priorityRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { fontSize: 14, color: "#111827" },
  priorityValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
});