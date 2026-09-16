import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Ticket } from "../../types/ticket";
import { getTicketStatusLabel } from "../../constants/ticket-status";
import { AI_PRIORITY_LABELS, AI_PRIORITY_STYLES } from "../../constants/ai-priority";
import { formatRelativeTicketTime } from "../../utils/format-ticket-date";
import { getDisplayTicketCode } from "../../utils/ticket-code";

interface TicketCardProps {
  ticket: Ticket;
  onPress?: () => void;
}

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  const displayCode = getDisplayTicketCode(ticket);
  const displayName = ticket.customerName?.trim() || "Khách hàng";
  const displayTime = formatRelativeTicketTime(ticket.createdAt);
  const statusLabel = getTicketStatusLabel(ticket.status);
  const priorityStyle = ticket.priority ? AI_PRIORITY_STYLES[ticket.priority] : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.iconWrapper}>
        <Text style={styles.iconGlyph}>🎫</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {displayCode}
          </Text>

          {priorityStyle && ticket.priority && (
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: priorityStyle.bg, borderColor: priorityStyle.border },
              ]}
            >
              <Text style={[styles.priorityBadgeText, { color: priorityStyle.text }]}>
                {AI_PRIORITY_LABELS[ticket.priority]}
              </Text>
            </View>
          )}
        </View>
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
    </Pressable>
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
  cardPressed: {
    backgroundColor: "#F9FAFB",
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
  iconGlyph: { fontSize: 18 },
  body: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" },
  priorityBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityBadgeText: { fontSize: 10, fontWeight: "700" },
  name: { marginTop: 2, fontSize: 13, color: "#6B7280" },
  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: { fontSize: 12, color: "#9CA3AF" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: "#1D4ED8" },
});