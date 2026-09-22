import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { TicketCard } from "../../components/cards/TicketCard";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToTickets } from "../../services/ticket.service";
import { AI_PRIORITY_LABELS } from "../../constants/ai-priority";
import { isTicketOverdue } from "../../utils/ticket-sla";
import type { Ticket } from "../../types/ticket";
import type { AIPriority } from "../../types/ai-result";

type FilterKey = "all" | "new" | "in_progress" | "overdue" | "closed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "new", label: "Mới" },
  { key: "in_progress", label: "Đang xử lý" },
  { key: "overdue", label: "Quá hạn" },
  { key: "closed", label: "Đã đóng" },
];

function isFilterKey(value: unknown): value is FilterKey {
  return typeof value === "string" && FILTERS.some((item) => item.key === value);
}

// Khớp với paramKey bên overview.tsx — dùng key không khoảng trắng để tránh
// bị mã hóa/giải mã sai lệch qua URL param khi điều hướng.
const PRIORITY_PARAM_MAP: Record<string, AIPriority> = {
  high: "High Priority",
  medium: "Medium",
  low: "Low",
};

function resolvePriorityParam(value: unknown): AIPriority | null {
  if (typeof value !== "string") return null;
  return PRIORITY_PARAM_MAP[value] ?? null;
}

function matchesFilter(ticket: Ticket, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "new") return ticket.status === "pending" || ticket.status === "ai_analyzed";
  if (filter === "in_progress") return ticket.status === "in_progress";
  if (filter === "overdue") return isTicketOverdue(ticket);
  return ticket.status === "responded" || ticket.status === "closed";
}

export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { filter: filterParam, priority: priorityParam, mine: mineParam } = useLocalSearchParams<{
    filter?: string;
    priority?: string;
    mine?: string;
  }>();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState<string>("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [priorityFilter, setPriorityFilter] = useState<AIPriority | null>(null);
  // "Ticket của tôi" — bật khi điều hướng từ trang Cá nhân (bấm "Đang xử lý"/
  // "Đã hoàn thành"). Độc lập với filter/priorityFilter, chỉ tắt khi bấm
  // "Xóa lọc" riêng, để đổi filter trạng thái không vô tình bỏ luôn phạm vi
  // "của tôi" mà người dùng đang muốn xem.
  const [mineOnly, setMineOnly] = useState<boolean>(mineParam === "1");

  // Cho phép Tổng quan điều hướng tới đây kèm sẵn bộ lọc (vd bấm thẻ "Ticket mới"
  // hoặc bấm 1 dòng mức độ ưu tiên). 2 bộ lọc này độc lập nhau — chỉ nên áp
  // đúng 1 loại tại 1 thời điểm, nên khi đặt loại này phải xóa loại kia,
  // tránh bị cộng dồn "vừa trạng thái X vừa ưu tiên Y" làm rỗng kết quả.
  useEffect(() => {
    const resolvedPriority = resolvePriorityParam(priorityParam);

    if (isFilterKey(filterParam)) {
      setFilter(filterParam);
      setPriorityFilter(null);
    } else if (resolvedPriority) {
      setPriorityFilter(resolvedPriority);
      setFilter("all");
    }

    if (mineParam === "1") {
      setMineOnly(true);
    }
  }, [filterParam, priorityParam, mineParam]);

  useEffect(() => {
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
  }, []);

  const filteredTickets = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (!matchesFilter(ticket, filter)) return false;
      if (priorityFilter && ticket.priority !== priorityFilter) return false;
      if (mineOnly && ticket.assignedTo !== user?.uid) return false;
      if (!keyword) return true;

      const haystack = `${ticket.code ?? ""} ${ticket.customerName ?? ""} ${ticket.content ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [tickets, filter, priorityFilter, mineOnly, user?.uid, searchText]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Danh sách ticket</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm ticket..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <Text
                key={item.key}
                onPress={() => {
                  setFilter(item.key);
                  setPriorityFilter(null);
                }}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
              >
                {item.label}
              </Text>
            );
          })}
        </ScrollView>

        {priorityFilter && (
          <View style={styles.priorityFilterRow}>
            <Text style={styles.priorityFilterText}>
              Đang lọc theo mức độ ưu tiên: {AI_PRIORITY_LABELS[priorityFilter]}
            </Text>
            <Pressable onPress={() => setPriorityFilter(null)} hitSlop={8}>
              <Text style={styles.priorityFilterClear}>Xóa lọc ✕</Text>
            </Pressable>
          </View>
        )}

        {mineOnly && (
          <View style={styles.priorityFilterRow}>
            <Text style={styles.priorityFilterText}>Chỉ hiện ticket của bạn</Text>
            <Pressable onPress={() => setMineOnly(false)} hitSlop={8}>
              <Text style={styles.priorityFilterClear}>Xóa lọc ✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Tổng cộng: {filteredTickets.length} tickets</Text>
          <Text style={styles.summarySortText}>Mới nhất</Text>
        </View>
      </View>

      {loading ? (
        <FullScreenLoading message="Đang tải danh sách khiếu nại..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Không thể tải danh sách khiếu nại.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => router.push(`/ticket/${item.id}`)}
            />
          )}
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
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  searchBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  filterRow: { marginTop: 12, flexDirection: "row", gap: 8 },
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
  filterChipActive: {
    backgroundColor: "#1667B1",
    color: "#FFFFFF",
  },
  priorityFilterRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priorityFilterText: { fontSize: 12, color: "#1D4ED8", fontWeight: "600" },
  priorityFilterClear: { fontSize: 12, color: "#1D4ED8", fontWeight: "700" },
  summaryRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryText: { fontSize: 12, color: "#6B7280" },
  summarySortText: { fontSize: 12, fontWeight: "700", color: "#1667B1" },
  listContent: { paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#B91C1C", textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151", textAlign: "center" },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: "#9CA3AF", textAlign: "center" },
});
