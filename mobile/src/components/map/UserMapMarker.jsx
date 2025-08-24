import React from "react";
import { View, Image, Text } from "react-native";
import { Marker } from "react-native-maps";
import { useTheme } from "../../utils/theme";

export function UserMapMarker({ user, onPress }) {
  const { colors } = useTheme();

  return (
    <Marker
      coordinate={user.location}
      onPress={() => onPress(user)}
      tracksViewChanges={false} // Improve performance for real-time updates
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Drop shadow */}
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            position: "absolute",
            top: 2,
            left: 2,
          }}
        />

        {/* Main marker container */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "white",
            borderWidth: 3,
            borderColor: user.is_online ? colors.primary : colors.offline,
            overflow: "hidden",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 8,
          }}
        >
          {/* Profile picture */}
          <Image
            source={{ uri: user.photos[0] }}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
            }}
            resizeMode="cover"
          />
        </View>

        {/* Online status indicator */}
        {user.is_online && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.online,
              borderWidth: 2,
              borderColor: "white",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 5,
            }}
          />
        )}

        {/* Name label (appears on closer zoom) */}
        <View
          style={{
            marginTop: 8,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 4,
            minWidth: 40,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 11,
              fontFamily: "Inter_500Medium",
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {user.display_name}
          </Text>
        </View>

        {/* Pulse animation for active users */}
        {user.is_online && (
          <View
            style={{
              position: "absolute",
              width: 70,
              height: 70,
              borderRadius: 35,
              borderWidth: 2,
              borderColor: colors.primary,
              opacity: 0.3,
              top: -7,
              left: -7,
            }}
          />
        )}
      </View>
    </Marker>
  );
}
