import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTickets } from "../../services/ticket.service";
import { isTicketOverdue } from "../../utils/ticket-sla";
import type { Ticket } from "../../types/ticket";

const NEW_STATUSES = new Set(["pending", "ai_analyzed"]);
const DONE_STATUSES = new Set(["responded", "closed"]);

// paramKey không có khoảng trắng — dùng để truyền qua URL param khi điều
// hướng sang Tickets, tránh "High Priority" (có khoảng trắng) bị mã hóa/giải
// mã sai lệch qua router, làm điều kiện lọc không bao giờ khớp được.
const PRIORITY_ROWS: {
  key: "High Priority" | "Medium" | "Low";
  paramKey: string;
  label: string;
  dotColor: string;
}[] = [
  { key: "High Priority", paramKey: "high", label: "Cao", dotColor: "#EF4444" },
  { key: "Medium", paramKey: "medium", label: "Trung bình", dotColor: "#F97316" },
  { key: "Low", paramKey: "low", label: "Thấp", dotColor: "#6366F1" },
];

function formatToday(): string {
  const now = new Date();
  return `Hôm nay, ${now.toLocaleDateString("vi-VN")}`;
}

export default function OverviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
    let overdueCount = 0;
    const priorityCount: Record<string, number> = { "High Priority": 0, Medium: 0, Low: 0 };

    let ratingSum = 0;
    let ratingCount = 0;
    let ratingHighCount = 0; // đánh giá 4-5 sao

    for (const ticket of tickets) {
      if (NEW_STATUSES.has(ticket.status)) newCount += 1;
      else if (ticket.status === "in_progress") inProgressCount += 1;
      else if (DONE_STATUSES.has(ticket.status)) doneCount += 1;

      if (isTicketOverdue(ticket)) overdueCount += 1;

      if (ticket.priority && ticket.priority in priorityCount) {
        priorityCount[ticket.priority] += 1;
      }

      if (ticket.rating) {
        ratingSum += ticket.rating;
        ratingCount += 1;
        if (ticket.rating >= 4) ratingHighCount += 1;
      }
    }

    const averageRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
    const highRatingPercent = ratingCount > 0 ? Math.round((ratingHighCount / ratingCount) * 100) : 0;

    return {
      newCount,
      inProgressCount,
      doneCount,
      overdueCount,
      priorityCount,
      averageRating,
      ratingCount,
      highRatingPercent,
    };
  }, [tickets]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >
      <Text style={styles.title}>Tổng quan công việc</Text>
      <Text style={styles.subtitle}>{formatToday()}</Text>

      <View style={styles.statRow}>
        <Pressable
          style={[styles.statCard, { backgroundColor: "#EEF2FF" }]}
          onPress={() => router.push({ pathname: "/tickets", params: { filter: "new" } })}
        >
          <Text style={styles.statLabel}>TICKET MỚI</Text>
          <Text style={[styles.statValue, { color: "#4338CA" }]}>{stats.newCount}</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, { backgroundColor: "#FFF1E8" }]}
          onPress={() => router.push({ pathname: "/tickets", params: { filter: "in_progress" } })}
        >
          <Text style={styles.statLabel}>ĐANG XỬ LÝ</Text>
          <Text style={[styles.statValue, { color: "#C2410C" }]}>
            {String(stats.inProgressCount).padStart(2, "0")}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.statRow, styles.statRowSecond]}>
        <Pressable
          style={[styles.statCard, { backgroundColor: "#FEF2F2" }]}
          onPress={() => router.push({ pathname: "/tickets", params: { filter: "overdue" } })}
        >
          <Text style={styles.statLabel}>QUÁ HẠN</Text>
          <Text style={[styles.statValue, { color: "#B91C1C" }]}>
            {String(stats.overdueCount).padStart(2, "0")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, { backgroundColor: "#ECFDF5" }]}
          onPress={() => router.push({ pathname: "/tickets", params: { filter: "closed" } })}
        >
          <Text style={styles.statLabel}>ĐÃ HOÀN THÀNH</Text>
          <Text style={[styles.statValue, { color: "#047857" }]}>
            {String(stats.doneCount).padStart(2, "0")}
          </Text>
        </Pressable>
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
          <Pressable
            key={row.key}
            style={styles.priorityRow}
            onPress={() =>
              router.push({ pathname: "/tickets", params: { priority: row.paramKey } })
            }
          >
            <View style={styles.priorityRowLeft}>
              <View style={[styles.priorityDot, { backgroundColor: row.dotColor }]} />
              <Text style={styles.priorityLabel}>{row.label}</Text>
            </View>
            <Text style={styles.priorityValue}>{stats.priorityCount[row.key]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, styles.satisfactionTitle]}>Đánh giá khách hàng</Text>

      {stats.ratingCount > 0 ? (
        <View style={styles.satisfactionCard}>
          <View style={styles.satisfactionRow}>
            <Text style={styles.satisfactionScore}>{stats.averageRating.toFixed(1)}/5</Text>
            <Text style={styles.satisfactionStars}>
              {"★".repeat(Math.round(stats.averageRating))}
              {"☆".repeat(5 - Math.round(stats.averageRating))}
            </Text>
          </View>
          <Text style={styles.satisfactionMeta}>{stats.ratingCount} lượt đánh giá</Text>
          <Text style={styles.satisfactionMeta}>
            {stats.highRatingPercent}% đánh giá 4–5 sao
          </Text>
        </View>
      ) : (
        <View style={styles.satisfactionCard}>
          <Text style={styles.satisfactionMeta}>Chưa có đánh giá nào từ khách hàng.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  statRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  statRowSecond: { marginTop: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16 },
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
  satisfactionTitle: { marginTop: 28 },
  satisfactionCard: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  satisfactionRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  satisfactionScore: { fontSize: 22, fontWeight: "800", color: "#111827" },
  satisfactionStars: { fontSize: 16, color: "#F59E0B", letterSpacing: 1 },
  satisfactionMeta: { marginTop: 6, fontSize: 12, color: "#6B7280" },
});
