import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { TicketCard } from "../../components/cards/TicketCard";
import { subscribeToTickets } from "../../services/ticket.service";
import type { Ticket } from "../../types/ticket";

type FilterKey = "all" | "in_progress" | "closed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "in_progress", label: "Đang xử lý" },
  { key: "closed", label: "Đã đóng" },
];

function matchesFilter(ticket: Ticket, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "in_progress") return ticket.status === "in_progress";
  return ticket.status === "responded" || ticket.status === "closed";
}

export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState<string>("");
  const [filter, setFilter] = useState<FilterKey>("all");

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
      if (!keyword) return true;

      const haystack = `${ticket.code ?? ""} ${ticket.customerName ?? ""} ${ticket.content ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [tickets, filter, searchText]);

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

        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <Text
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
              >
                {item.label}
              </Text>
            );
          })}
        </View>

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