import { StyleSheet, Text, View } from "react-native";
import type { Ticket } from "../../types/ticket";
import { getTicketStatusLabel } from "../../constants/ticket-status";
import { formatRelativeTicketTime } from "../../utils/format-ticket-date";

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const displayName = ticket.customerName?.trim() || "Khách hàng";
  const displayContent = ticket.content?.trim() || "Không có nội dung";
  const displayTime = formatRelativeTicketTime(ticket.createdAt);
  const statusLabel = getTicketStatusLabel(ticket.status);

  return (
    <View style={styles.card}>
      <View style={styles.iconWrapper}>
        <Text style={styles.iconGlyph}>🎫</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {displayContent}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>

        <View style={styles.footerRow}>
          <Text style={styles.time}>Cập nhật: {displayTime}</Text>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconGlyph: {
    fontSize: 18,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  name: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8",
  },
});