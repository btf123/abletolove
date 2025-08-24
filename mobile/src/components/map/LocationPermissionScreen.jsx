import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Navigation } from "lucide-react-native";
import { useTheme } from "../../utils/theme";

export function LocationPermissionScreen({ onGrantPermission }) {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 40,
        }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Navigation size={40} color={colors.primary} />
        </View>

        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 24,
            color: colors.text,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Location Access Needed
        </Text>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          To find people near you, we need access to your location. This helps
          us show you potential matches in your area.
        </Text>

        <TouchableOpacity
          onPress={onGrantPermission}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 25,
            paddingHorizontal: 32,
            paddingVertical: 16,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
            }}
          >
            Enable Location
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
