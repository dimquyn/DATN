import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface FullScreenLoadingProps {
  message?: string;
}

export function FullScreenLoading({
  message = "Đang tải...",
}: FullScreenLoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1667B1" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 16,
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
  },
});