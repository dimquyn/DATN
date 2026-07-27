import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Telecom AI Support</Text>

        <Text style={styles.subtitle}>
          Ứng dụng hỗ trợ xử lý khiếu nại khách hàng
        </Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Mobile app đã khởi động thành công</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    color: "#1F2937",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#6B7280",
  },
  statusBox: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#E8F3FF",
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: "#1667B1",
  },
});