import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "../../utils/theme";

export function LoadingScreen({ message }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 16,
          color: colors.textSecondary,
          marginTop: 12,
        }}
      >
        {message || "Loading..."}
      </Text>
    </View>
  );
}
