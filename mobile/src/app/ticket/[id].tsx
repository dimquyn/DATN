import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { getTicketById } from "../../services/ticket.service";
import { getAIResultById } from "../../services/ai-result.service";
import { getTicketStatusLabel } from "../../constants/ticket-status";
import { formatTicketDate } from "../../utils/format-ticket-date";
import type { Ticket } from "../../types/ticket";
import type { AIPriority, AIResult } from "../../types/ai-result";

// Chỉ để hiển thị — KHÔNG ghi ngược vào Firestore, Firestore không có field mã ticket.
function getDisplayTicketCode(ticketId: string): string {
  return `#TK-${ticketId.slice(-6).toUpperCase()}`;
}

const PRIORITY_STYLES: Record<AIPriority, { bg: string; border: string; text: string }> = {
  "High Priority": { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  Medium: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  Low: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
};

export default function TicketDetailScreen() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketLoading, setTicketLoading] = useState<boolean>(true);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const [aiResult, setAIResult] = useState<AIResult | null>(null);
  const [aiLoading, setAILoading] = useState<boolean>(false);
  const [aiError, setAIError] = useState<string | null>(null);

  const [showReply, setShowReply] = useState<boolean>(false);

  useEffect(() => {
    if (!user || !id) return;

    let cancelled = false;

    const load = async () => {
      setTicketLoading(true);
      setTicketError(null);
      setAIResult(null);
      setAIError(null);

      try {
        const foundTicket = await getTicketById(id);

        if (cancelled) return;

        if (!foundTicket) {
          setTicket(null);
          setTicketError("Không tìm thấy khiếu nại.");
          setTicketLoading(false);
          return;
        }

        setTicket(foundTicket);
        setTicketLoading(false);

        if (foundTicket.aiResultId) {
          setAILoading(true);

          try {
            const foundAIResult = await getAIResultById(foundTicket.aiResultId);

            if (cancelled) return;

            if (!foundAIResult) {
              setAIError("Kết quả phân tích AI không tồn tại.");
            } else if (foundAIResult.ticketId !== foundTicket.id) {
              // Kiểm tra quan hệ dữ liệu — không crash, chỉ báo không hợp lệ.
              setAIError("Dữ liệu phân tích AI không hợp lệ.");
            } else {
              setAIResult(foundAIResult);
            }
          } catch (err) {
            if (!cancelled) {
              console.error("Lỗi khi tải kết quả AI:", err);
              setAIError("Không thể tải kết quả phân tích AI.");
            }
          } finally {
            if (!cancelled) setAILoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Lỗi khi tải chi tiết khiếu nại:", err);
          setTicketError("Không thể tải chi tiết khiếu nại.");
          setTicketLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user, id]);

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (ticketLoading) {
    return <FullScreenLoading message="Đang tải chi tiết khiếu nại..." />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Chi tiết ticket</Text>
        <View style={styles.headerSpacer} />
      </View>

      {ticketError !== null || !ticket ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{ticketError ?? "Không tìm thấy khiếu nại."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentWrapper}>
            {/* Mã yêu cầu */}
            <View style={styles.card}>
              <View style={styles.codeRow}>
                <View>
                  <Text style={styles.labelText}>MÃ YÊU CẦU</Text>
                  <Text style={styles.codeText}>{getDisplayTicketCode(ticket.id)}</Text>
                </View>

                {aiResult && (
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: PRIORITY_STYLES[aiResult.priority].bg,
                        borderColor: PRIORITY_STYLES[aiResult.priority].border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        { color: PRIORITY_STYLES[aiResult.priority].text },
                      ]}
                    >
                      {aiResult.priority}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Thông tin khách hàng */}
            <View style={styles.card}>
              <InfoRow label="KHÁCH HÀNG" value={ticket.customerName || "Khách hàng"} />
              <InfoRow label="SỐ ĐIỆN THOẠI" value={ticket.phone || "Không xác định"} />
              <InfoRow label="EMAIL" value={ticket.email || "Không xác định"} />
              <InfoRow label="KÊNH TIẾP NHẬN" value={ticket.channel || "Không xác định"} />
              <InfoRow
                label="THỜI GIAN TẠO"
                value={formatTicketDate(ticket.createdAt)}
                isLast
              />
              <View style={styles.statusRow}>
                <Text style={styles.labelText}>TRẠNG THÁI</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {getTicketStatusLabel(ticket.status)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Nội dung khiếu nại */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>NỘI DUNG KHIẾU NẠI</Text>
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>“{ticket.content}”</Text>
              </View>
            </View>

            {/* Kết quả AI */}
            {ticket.aiResultId ? (
              aiLoading ? (
                <View style={styles.card}>
                  <View style={styles.aiLoadingRow}>
                    <ActivityIndicator size="small" color="#1667B1" />
                    <Text style={styles.aiLoadingText}>Đang tải kết quả phân tích AI...</Text>
                  </View>
                </View>
              ) : aiError ? (
                <View style={styles.card}>
                  <Text style={styles.errorTextInline}>{aiError}</Text>
                </View>
              ) : aiResult ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>KẾT QUẢ PHÂN TÍCH AI</Text>

                  <FieldBlock label="PHÂN LOẠI" value={aiResult.category} />
                  <FieldBlock label="MỨC ĐỘ ƯU TIÊN" value={aiResult.priority} />
                  <FieldBlock label="CẢM XÚC KHÁCH HÀNG" value={aiResult.sentiment} />
                  <FieldBlock label="TÓM TẮT" value={aiResult.summary} />
                  <FieldBlock label="HƯỚNG XỬ LÝ GỢI Ý" value={aiResult.suggestion} isLast />

                  <Pressable
                    onPress={() => setShowReply((prev) => !prev)}
                    style={styles.replyButton}
                  >
                    <Text style={styles.replyButtonText}>
                      {showReply ? "Ẩn phản hồi đề xuất" : "Xem phản hồi đề xuất"}
                    </Text>
                  </Pressable>

                  {showReply && (
                    <View style={styles.replyBox}>
                      <Text style={styles.replyLabel}>PHẢN HỒI ĐỀ XUẤT</Text>
                      <Text style={styles.replyText}>{aiResult.reply}</Text>
                    </View>
                  )}
                </View>
              ) : null
            ) : ticket.lastAIError ? (
              <View style={styles.card}>
                <Text style={styles.pendingText}>Không thể phân tích khiếu nại bằng AI.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.pendingText}>AI đang phân tích khiếu nại.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast ? styles.infoRowLast : null]}>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

function FieldBlock({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.fieldBlock, isLast ? styles.fieldBlockLast : null]}>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.fieldValueText}>{value}</Text>
    </View>
  );
}

const MAX_CONTENT_WIDTH = 820;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
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
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: "0px 1px 2px rgba(15, 23, 42, 0.04)" },
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
    }),
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.4,
  },
  codeText: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityBadgeText: { fontSize: 12, fontWeight: "700" },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoRowLast: { borderBottomWidth: 0 },
  valueText: {
    marginTop: 4,
    fontSize: 14,
    color: "#111827",
  },
  statusRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  quoteBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    fontStyle: "italic",
  },
  aiLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiLoadingText: { fontSize: 13, color: "#6B7280" },
  errorTextInline: { fontSize: 13, color: "#B91C1C" },
  errorText: { fontSize: 14, color: "#B91C1C", textAlign: "center" },
  pendingText: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldBlockLast: { marginBottom: 0 },
  fieldValueText: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
  },
  replyButton: {
    marginTop: 16,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  replyButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  replyBox: {
    marginTop: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  replyText: { fontSize: 14, lineHeight: 20, color: "#111827" },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
});