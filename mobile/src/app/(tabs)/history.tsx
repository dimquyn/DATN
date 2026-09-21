import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { TicketCard } from "../../components/cards/TicketCard";
import { subscribeToTickets } from "../../services/ticket.service";
import type { Ticket } from "../../types/ticket";

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    const unsubscribe = subscribeToTickets(
      (nextTickets) => {
        setTickets(nextTickets);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách ticket:", err);
        setError("Không thể tải danh sách ticket.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredTickets = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return tickets;

    return tickets.filter((ticket) => {
      const haystack = `${ticket.code ?? ""} ${ticket.customerName ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [tickets, searchText]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Lịch sử xử lý</Text>
        <Text style={styles.subtitle}>Chọn 1 ticket để xem lịch sử xử lý chi tiết</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm theo mã ticket, tên khách hàng..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <FullScreenLoading message="Đang tải danh sách ticket..." />
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => router.push(`/ticket/history/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Text style={styles.emptyTitle}>Chưa có ticket nào</Text>
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
  listContent: { paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#B91C1C", textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151", textAlign: "center" },
});
