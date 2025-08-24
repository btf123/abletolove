import { useAuth } from "@/utils/auth/useAuth";
import { AuthModal } from "@/utils/auth/useAuthModal";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Initialize database when app loads
const setupDatabase = async () => {
  try {
    console.log("Setting up dating app database...");
    const response = await fetch("/api/database/setup", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Database setup failed: ${response.status}`);
    }

    const result = await response.json();
    console.log("Database setup complete:", result.message);
  } catch (error) {
    console.error("Database setup error:", error);
    // Don't crash the app if setup fails - database might already exist
  }
};

export default function RootLayout() {
  const { initiate, isReady } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      // Setup database when auth is ready
      setupDatabase();
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <AuthModal />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
            }}
            initialRouteName="index"
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
