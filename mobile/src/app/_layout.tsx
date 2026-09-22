import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { ErrorBoundary } from "../components/common/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />

          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}