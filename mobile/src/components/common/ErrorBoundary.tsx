import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Lưới an toàn cho cả app — nếu 1 màn hình bất kỳ crash do lỗi JS không
 * lường trước, hiện thông báo + nút "Thử lại" thay vì màn hình trắng không
 * rõ nguyên nhân (nhất là lúc demo/bảo vệ đồ án).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error("Lỗi không mong muốn:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Đã có lỗi xảy ra</Text>
          <Text style={styles.message}>
            Vui lòng thử lại. Nếu vẫn còn lỗi, hãy khởi động lại ứng dụng.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#F5F7FA",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#B91C1C", marginBottom: 8 },
  message: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 20 },
  button: {
    backgroundColor: "#1667B1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
