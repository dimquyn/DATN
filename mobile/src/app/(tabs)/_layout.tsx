import { Text } from "react-native";
import type { ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { FullScreenLoading } from "../../components/common/FullScreenLoading";

const TAB_ICONS: Record<string, string> = {
  overview: "📊",
  tickets: "🎫",
  history: "🕓",
  profile: "👤",
};

function TabIcon({ route, color }: { route: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route] ?? "•"}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();

  if (initializing) {
    return <FullScreenLoading message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#1667B1",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color }) => <TabIcon route={route.name} color={color} />,
      })}
    >
      <Tabs.Screen name="overview" options={{ title: "Tổng quan" }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
      <Tabs.Screen name="history" options={{ title: "Lịch sử" }} />
      <Tabs.Screen name="profile" options={{ title: "Cá nhân" }} />
    </Tabs>
  );
}
