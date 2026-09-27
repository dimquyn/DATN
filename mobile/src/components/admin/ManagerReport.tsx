import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { subscribeToAICategories } from "../../services/ai-result.service";
import { isAwaitingAdmin } from "../../services/ticket.service";
import { subscribeToStaffList } from "../../services/staff.service";
import type { AICategory } from "../../types/ai-result";
import type { StaffProfile } from "../../types/staff";
import type { Ticket } from "../../types/ticket";
import {
  REPORT_PERIODS,
  buildManagerReport,
  formatDuration,
  type ReportPeriod,
} from "../../utils/manager-report";

interface ManagerReportProps {
  /** Danh sách ticket realtime — dùng chung luồng dữ liệu với màn Tổng quan. */
  tickets: Ticket[];
}

/**
 * Báo cáo tổng hợp dành cho quản trị viên: thời gian phản hồi/xử lý trung
 * bình, tỉ lệ đúng hạn, số liệu theo từng nhân viên và theo nhóm khiếu nại.
 * Bấm 1 nhân viên để xem danh sách ticket của người đó (rồi mở chi tiết,
 * lịch sử xử lý như bình thường).
 * Chỉ render cho admin — firestore.rules chỉ cho admin đọc danh sách staff.
 */
export function ManagerReport({ tickets }: ManagerReportProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [categories, setCategories] = useState<Record<string, AICategory>>({});
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsubCategories = subscribeToAICategories(setCategories, (err) => {
      console.error("Lỗi khi tải nhóm khiếu nại:", err);
      setLoadError("Không tải được đủ dữ liệu báo cáo. Vui lòng thử lại.");
    });
    const unsubStaff = subscribeToStaffList(setStaff, (err) => {
      console.error("Lỗi khi tải danh sách nhân viên:", err);
      setLoadError("Không tải được đủ dữ liệu báo cáo. Vui lòng thử lại.");
    });
    return () => {
      unsubCategories();
      unsubStaff();
    };
  }, []);

  const report = useMemo(
    () => buildManagerReport(tickets, categories, staff, period),
    [tickets, categories, staff, period]
  );

  // Hàng chờ không phụ thuộc khoảng thời gian: ticket chờ lâu vẫn phải hiện.
  const awaitingAdminCount = useMemo(() => tickets.filter(isAwaitingAdmin).length, [tickets]);

  const maxCategoryCount = Math.max(1, ...report.categoryRows.map((row) => row.count));
  const onTimeText =
    report.onTimeRate === null ? "—" : `${Math.round(report.onTimeRate * 100)}%`;

  return (
    <View>
      <View style={styles.periodRow}>
        {REPORT_PERIODS.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.periodChip, period === option.key && styles.periodChipActive]}
            onPress={() => setPeriod(option.key)}
          >
            <Text style={[styles.periodText, period === option.key && styles.periodTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadError && <Text style={styles.errorText}>{loadError}</Text>}

      <Pressable
        style={[styles.queueCard, awaitingAdminCount > 0 ? styles.queueCardActive : null]}
        onPress={() => router.push({ pathname: "/tickets", params: { filter: "escalated" } })}
      >
        <View style={styles.queueTextBox}>
          <Text style={styles.queueTitle}>Ticket chờ quản trị viên</Text>
          <Text style={styles.queueMeta}>
            {awaitingAdminCount > 0
              ? "Nhân viên đã chuyển lên, cần bạn tiếp nhận →"
              : "Không có ticket nào đang chờ"}
          </Text>
        </View>
        <Text style={[styles.queueCount, awaitingAdminCount > 0 ? styles.queueCountActive : null]}>
          {awaitingAdminCount}
        </Text>
      </Pressable>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TICKET TRONG KỲ</Text>
          <Text style={styles.kpiValue}>{report.total}</Text>
          <Text style={styles.kpiMeta}>{report.responded} đã phản hồi</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>ĐÚNG HẠN SLA</Text>
          <Text style={[styles.kpiValue, { color: "#047857" }]}>{onTimeText}</Text>
          <Text style={styles.kpiMeta}>
            {report.onTimeCount}/{report.timedCount} ticket đã phản hồi
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PHẢN HỒI TRUNG BÌNH</Text>
          <Text style={[styles.kpiValue, styles.kpiValueSmall]}>
            {formatDuration(report.avgResponseMs)}
          </Text>
          <Text style={styles.kpiMeta}>từ lúc khách gửi</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>XỬ LÝ TRUNG BÌNH</Text>
          <Text style={[styles.kpiValue, styles.kpiValueSmall]}>
            {formatDuration(report.avgHandleMs)}
          </Text>
          <Text style={styles.kpiMeta}>từ lúc nhân viên nhận</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Theo nhân viên</Text>
      <Text style={styles.sectionHint}>Bấm vào 1 nhân viên để xem danh sách ticket của người đó.</Text>
      <View style={styles.card}>
        <View style={[styles.tableRow, styles.tableHead]}>
          <Text style={[styles.headCell, styles.colName]}>Nhân viên</Text>
          <Text style={[styles.headCell, styles.colNum]}>Đang xử lý</Text>
          <Text style={[styles.headCell, styles.colNum]}>Đã xong</Text>
          <Text style={[styles.headCell, styles.colTime]}>Xử lý TB</Text>
          <Text style={[styles.headCell, styles.colNum]}>Đánh giá</Text>
        </View>
        {report.staffRows.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có dữ liệu nhân viên.</Text>
        ) : (
          report.staffRows.map((row, index) => (
            <Pressable
              key={row.uid}
              onPress={() =>
                router.push({ pathname: "/tickets", params: { assignee: row.uid, assigneeName: row.name } })
              }
              style={({ pressed }) => [
                styles.tableRow,
                index === report.staffRows.length - 1 && styles.tableRowLast,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.colName}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.subText} numberOfLines={1}>
                  {row.role === "admin" ? "Quản trị viên" : row.active ? "Nhân viên" : "Đã khóa / đã xóa"}
                </Text>
              </View>
              <Text style={[styles.cell, styles.colNum]}>{row.inProgress}</Text>
              <Text style={[styles.cell, styles.colNum, styles.cellStrong]}>{row.done}</Text>
              <Text style={[styles.cell, styles.colTime]}>{formatDuration(row.avgHandleMs)}</Text>
              <Text style={[styles.cell, styles.colNum]}>
                {row.avgRating === null ? "—" : `${row.avgRating.toFixed(1)}★`}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Theo nhóm khiếu nại</Text>
      <View style={styles.card}>
        {report.categoryRows.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có ticket trong khoảng thời gian này.</Text>
        ) : (
          report.categoryRows.map((row, index) => (
            <View
              key={row.category}
              style={[styles.categoryRow, index === report.categoryRows.length - 1 && styles.tableRowLast]}
            >
              <View style={styles.categoryHead}>
                <Text style={styles.nameText}>{row.category}</Text>
                <Text style={styles.categoryCount}>{row.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(row.count / maxCategoryCount) * 100}%` }]} />
              </View>
              <Text style={styles.subText}>
                Phản hồi TB {formatDuration(row.avgResponseMs)} · {row.highPriority} ưu tiên cao
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.footnote}>
        Thời gian tính trên {report.timedCount}/{report.responded} ticket đã phản hồi có đủ mốc thời gian.
        Ticket xử lý trước khi hệ thống ghi mốc thời gian chỉ được tính số lượng.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  periodRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  periodChipActive: { backgroundColor: "#4338CA", borderColor: "#4338CA" },
  periodText: { fontSize: 13, fontWeight: "600", color: "#4B5563" },
  periodTextActive: { color: "#FFFFFF" },
  errorText: { marginTop: 10, fontSize: 12, color: "#B91C1C" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  kpiCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  kpiLabel: { fontSize: 10.5, fontWeight: "700", color: "#6B7280", letterSpacing: 0.4 },
  kpiValue: { marginTop: 8, fontSize: 26, fontWeight: "800", color: "#111827" },
  kpiValueSmall: { fontSize: 20, color: "#4338CA" },
  kpiMeta: { marginTop: 4, fontSize: 11.5, color: "#6B7280" },
  sectionTitle: { marginTop: 26, fontSize: 16, fontWeight: "700", color: "#111827" },
  sectionHint: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  rowPressed: { backgroundColor: "#F5F7FF" },
  queueCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  queueCardActive: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  queueTextBox: { flex: 1 },
  queueTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  queueMeta: { marginTop: 3, fontSize: 12, color: "#6B7280" },
  queueCount: { fontSize: 26, fontWeight: "800", color: "#9CA3AF", fontVariant: ["tabular-nums"] },
  queueCountActive: { color: "#B91C1C" },
  card: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableHead: { backgroundColor: "#F9FAFB", paddingVertical: 9 },
  headCell: { fontSize: 10.5, fontWeight: "700", color: "#6B7280" },
  colName: { flex: 1, paddingRight: 6 },
  colNum: { width: 52, textAlign: "center" },
  colTime: { width: 64, textAlign: "center" },
  cell: { fontSize: 13, color: "#374151", fontVariant: ["tabular-nums"] },
  cellStrong: { fontWeight: "700", color: "#111827" },
  nameText: { fontSize: 13.5, fontWeight: "600", color: "#111827" },
  subText: { marginTop: 2, fontSize: 11.5, color: "#6B7280" },
  emptyText: { padding: 14, fontSize: 13, color: "#6B7280" },
  categoryRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  categoryCount: { fontSize: 15, fontWeight: "700", color: "#111827", fontVariant: ["tabular-nums"] },
  barTrack: { marginTop: 8, height: 8, borderRadius: 4, backgroundColor: "#EEF2FF" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: "#6366F1" },
  footnote: { marginTop: 12, fontSize: 11.5, color: "#9CA3AF", lineHeight: 16 },
});
