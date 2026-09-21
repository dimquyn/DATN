import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { FullScreenLoading } from "../components/common/FullScreenLoading";
import { subscribeToTickets } from "../services/ticket.service";
import { formatTicketDate } from "../utils/format-ticket-date";
import { getDisplayTicketCode } from "../utils/ticket-code";
import type { Ticket } from "../types/ticket";

type StarFilter = "all" | 1 | 2 | 3 | 4 | 5;

const STAR_OPTIONS: { key: StarFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: 5, label: "★★★★★" },
  { key: 4, label: "★★★★☆" },
  { key: 3, label: "★★★☆☆" },
  { key: 2, label: "★★☆☆☆" },
  { key: 1, label: "★☆☆☆☆" },
];

function parseStarParam(value: unknown): StarFilter {
  const n = Number(value);
  return n >= 1 && n <= 5 ? (n as StarFilter) : "all";
}

export default function RatingsScreen() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { star: starParam } = useLocalSearchParams<{ star?: string }>();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [starFilter, setStarFilter] = useState<StarFilter>(() => parseStarParam(starParam));

  useEffect(() => {
    setStarFilter(parseStarParam(starParam));
  }, [starParam]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToTickets(
      (nextTickets) => {
        setTickets(nextTickets);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách đánh giá:", err);
        setError("Không thể tải danh sách đánh giá.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const ratedTickets = useMemo(() => {
    return tickets
      .filter((ticket) => ticket.rating != null)
      .filter((ticket) => starFilter === "all" || ticket.rating === starFilter)
      .sort((a, b) => (b.ratedAt?.toMillis() ?? 0) - (a.ratedAt?.toMillis() ?? 0));
  }, [tickets, starFilter]);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Đánh giá khách hàng</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STAR_OPTIONS.map((option) => {
            const active = option.key === starFilter;
            return (
              <Text
                key={option.key}
                onPress={() => setStarFilter(option.key)}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
              >
                {option.label}
              </Text>
            );
          })}
        </ScrollView>
        <Text style={styles.summaryText}>{ratedTickets.length} đánh giá</Text>
      </View>

      {loading ? (
        <FullScreenLoading message="Đang tải danh sách đánh giá..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={ratedTickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
              onPress={() => router.push(`/ticket/${item.id}`)}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardCode}>{getDisplayTicketCode(item)}</Text>
                <Text style={styles.cardStars}>
                  {"★".repeat(item.rating ?? 0)}
                  {"☆".repeat(5 - (item.rating ?? 0))}
                </Text>
              </View>
              <Text style={styles.cardName}>{item.customerName?.trim() || "Khách hàng"}</Text>
              {item.ratingComment ? (
                <Text style={styles.cardComment}>“{item.ratingComment}”</Text>
              ) : (
                <Text style={styles.cardCommentEmpty}>Không có nhận xét</Text>
              )}
              <Text style={styles.cardDate}>{formatTicketDate(item.ratedAt)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>
                {starFilter === "all"
                  ? "Chưa có đánh giá nào từ khách hàng."
                  : "Không có đánh giá nào ở mức sao này."}
              </Text>
            </View>
          }
        />
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
  filterBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 12,
  },
  filterRow: { paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 8 },
  filterChip: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  filterChipActive: { backgroundColor: "#1667B1", color: "#FFFFFF" },
  summaryText: { marginTop: 8, paddingHorizontal: 16, fontSize: 12, color: "#6B7280" },
  listContent: { padding: 16, flexGrow: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  errorText: { fontSize: 14, color: "#B91C1C", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 12,
  },
  cardPressed: { backgroundColor: "#F9FAFB" },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardCode: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardStars: { fontSize: 14, color: "#F59E0B", letterSpacing: 1 },
  cardName: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  cardComment: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#374151",
    fontStyle: "italic",
  },
  cardCommentEmpty: {
    marginTop: 8,
    fontSize: 13,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  cardDate: { marginTop: 8, fontSize: 11, color: "#9CA3AF" },
});
