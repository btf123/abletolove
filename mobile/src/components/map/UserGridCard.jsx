import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../../utils/theme";

export function UserGridCard({ user, onPress }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => onPress(user)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 12,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={{ uri: user.photos[0] }}
          style={{
            width: "100%",
            height: 180,
          }}
          resizeMode="cover"
        />

        {/* Online indicator */}
        {user.is_online && (
          <View
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.online,
              borderWidth: 2,
              borderColor: "white",
            }}
          />
        )}

        {/* Distance badge */}
        <View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 12,
              fontFamily: "Inter_500Medium",
            }}
          >
            {user.distance < 1
              ? `${Math.round(user.distance * 1000)}m`
              : `${user.distance}km`}
          </Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          {user.display_name}, {user.age}
        </Text>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          Active {user.last_active}
        </Text>
      </View>
    </TouchableOpacity>
  );
}