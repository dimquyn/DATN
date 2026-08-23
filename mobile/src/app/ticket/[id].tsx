import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";
import { getTicketById, updateTicketStatus } from "../../services/ticket.service";
import { getAIResultById } from "../../services/ai-result.service";
import { getNextTicketAction, getTicketStatusLabel } from "../../constants/ticket-status";
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

  // Nhận xử lý / Đóng khiếu nại (hành động chung, không liên quan phản hồi)
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Phản hồi khách hàng (đề xuất AI có thể sửa, hoặc nội dung đã gửi chỉ đọc)
  const [showReplySection, setShowReplySection] = useState<boolean>(false);
  const [replyDraft, setReplyDraft] = useState<string>("");
  const [replyDraftInitialized, setReplyDraftInitialized] = useState<boolean>(false);
  const [confirmingReply, setConfirmingReply] = useState<boolean>(false);
  const [confirmReplyError, setConfirmReplyError] = useState<string | null>(null);

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

  // Khởi tạo nội dung ô nhập phản hồi từ aiResult.reply — chỉ 1 lần,
  // để không ghi đè nội dung nhân viên đang sửa dở.
  useEffect(() => {
    if (
      aiResult &&
      !replyDraftInitialized &&
      (ticket?.status === "ai_analyzed" || ticket?.status === "in_progress")
    ) {
      setReplyDraft(aiResult.reply);
      setReplyDraftInitialized(true);
    }
  }, [aiResult, ticket?.status, replyDraftInitialized]);

  const handleAction = async () => {
    if (!user || !ticket || updating) return;

    const action = getNextTicketAction(ticket.status);
    if (!action) return;

    setUpdating(true);
    setUpdateError(null);

    try {
      const options =
        action.nextStatus === "in_progress" ? { assignedTo: user.uid } : undefined;

      await updateTicketStatus(ticket.id, action.nextStatus, options);

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: action.nextStatus,
              assignedTo: options?.assignedTo ?? prev.assignedTo,
            }
          : prev
      );
    } catch (err) {
      console.error("Lỗi khi cập nhật trạng thái ticket:", err);
      setUpdateError("Không thể cập nhật trạng thái. Vui lòng thử lại.");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmReply = async () => {
    if (!user || !ticket || confirmingReply) return;
    if (ticket.status !== "in_progress") return;

    const trimmed = replyDraft.trim();

    if (trimmed.length === 0) {
      setConfirmReplyError("Vui lòng nhập nội dung phản hồi trước khi xác nhận.");
      return;
    }

    setConfirmingReply(true);
    setConfirmReplyError(null);

    try {
      await updateTicketStatus(ticket.id, "responded", { finalReply: trimmed });

      setTicket((prev) =>
        prev ? { ...prev, status: "responded", finalReply: trimmed } : prev
      );
      setReplyDraft(trimmed);
    } catch (err) {
      console.error("Lỗi khi xác nhận phản hồi:", err);
      setConfirmReplyError("Không thể xác nhận phản hồi. Vui lòng thử lại.");
    } finally {
      setConfirmingReply(false);
    }
  };

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (ticketLoading) {
    return <FullScreenLoading message="Đang tải chi tiết khiếu nại..." />;
  }

  const isEditablePhase =
    ticket?.status === "ai_analyzed" || ticket?.status === "in_progress";
  const isRespondedPhase = ticket?.status === "responded" || ticket?.status === "closed";
  const showReplyToggle = !!ticket && ((isEditablePhase && !!aiResult) || isRespondedPhase);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
  onPress={() => router.replace("/dashboard")}
  style={styles.backButton}
  hitSlop={8}
>
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

            {/* Người xử lý (Sprint 4) */}
            {ticket.assignedTo && (
              <View style={styles.card}>
                <InfoRow
                  label="NGƯỜI XỬ LÝ"
                  value={ticket.assignedTo === user.uid ? "Bạn" : ticket.assignedTo}
                  isLast
                />
              </View>
            )}

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
                  <FieldBlock label="TÓM TẮT" value={aiResult.summary} isLast />
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

            {/* Phản hồi khách hàng (Sprint 4) */}
            {showReplyToggle && (
              <View style={styles.card}>
                <Pressable
                  onPress={() => setShowReplySection((prev) => !prev)}
                  style={styles.replyButton}
                >
                  <Text style={styles.replyButtonText}>
                    {isRespondedPhase
                      ? showReplySection
                        ? "Ẩn nội dung đã phản hồi"
                        : "Xem nội dung đã phản hồi"
                      : showReplySection
                      ? "Ẩn phản hồi đề xuất"
                      : "Xem phản hồi đề xuất"}
                  </Text>
                </Pressable>

                {showReplySection && (
                  <View style={styles.replyBox}>
                    {isRespondedPhase ? (
                      ticket.finalReply && ticket.finalReply.trim().length > 0 ? (
                        <>
                          <Text style={styles.replyLabel}>NỘI DUNG ĐÃ PHẢN HỒI</Text>
                          <Text style={styles.replyText}>{ticket.finalReply}</Text>
                        </>
                      ) : (
                        <Text style={styles.pendingText}>
                          Ticket này chưa có nội dung phản hồi thực tế được lưu.
                        </Text>
                      )
                    ) : (
                      <>
                        <Text style={styles.replyLabel}>
                          PHẢN HỒI ĐỀ XUẤT (CÓ THỂ CHỈNH SỬA)
                        </Text>
                        <TextInput
                          style={styles.replyInput}
                          multiline
                          value={replyDraft}
                          onChangeText={setReplyDraft}
                          editable={!confirmingReply}
                        />

                        {confirmReplyError && (
                          <Text style={styles.actionErrorText}>{confirmReplyError}</Text>
                        )}

                        {ticket.status === "in_progress" ? (
                          <Pressable
                            onPress={handleConfirmReply}
                            disabled={confirmingReply || replyDraft.trim().length === 0}
                            style={[
                              styles.actionButton,
                              confirmingReply || replyDraft.trim().length === 0
                                ? styles.actionButtonDisabled
                                : null,
                            ]}
                          >
                            {confirmingReply ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.actionButtonText}>Xác nhận đã phản hồi</Text>
                            )}
                          </Pressable>
                        ) : (
                          <Text style={styles.hintText}>
                            Nhận xử lý ticket trước khi phản hồi.
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Hành động Nhận xử lý / Đóng khiếu nại (Sprint 4) */}
            {(() => {
              const action = getNextTicketAction(ticket.status);

              if (!action) {
                return null;
              }

              const isClaimAction = ticket.status === "ai_analyzed";
              const isTakenByOther =
                isClaimAction && !!ticket.assignedTo && ticket.assignedTo !== user.uid;

              if (isTakenByOther) {
                return (
                  <View style={styles.card}>
                    <Text style={styles.pendingText}>
                      Ticket này đã được nhận xử lý bởi nhân viên khác.
                    </Text>
                  </View>
                );
              }

              return (
                <View style={styles.card}>
                  {updateError && <Text style={styles.actionErrorText}>{updateError}</Text>}
                  <Pressable
                    onPress={handleAction}
                    disabled={updating}
                    style={[
                      styles.actionButton,
                      updating ? styles.actionButtonDisabled : null,
                    ]}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionButtonText}>{action.label}</Text>
                    )}
                  </Pressable>
                </View>
              );
            })()}
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
    height: 42,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  replyButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  replyBox: {
    marginTop: 12,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  replyText: { fontSize: 14, lineHeight: 20, color: "#111827" },
  replyInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    minHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  actionButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: "#1667B1",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  actionErrorText: {
    fontSize: 13,
    color: "#B91C1C",
    marginBottom: 10,
    textAlign: "center",
  },
});