import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../../utils/theme";
import { Heart, MessageCircle } from "lucide-react-native";

export function UserProfileModal({ user, visible, onClose, onLike, onMessage }) {
  const { colors } = useTheme();

  if (!visible || !user) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
      >
        <Image
          source={{ uri: user.photos[0] }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            marginRight: 16,
          }}
        />

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginRight: 8,
              }}
            >
              {user.display_name}, {user.age}
            </Text>
            {user.is_online && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.online,
                }}
              />
            )}
          </View>

          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {user.distance < 1
              ? `${Math.round(user.distance * 1000)}m away`
              : `${user.distance}km away`}{" "}
            • Active {user.last_active}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 18,
              color: colors.textSecondary,
            }}
          >
            ×
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity
          onPress={() => onLike(user)}
          style={{
            flex: 1,
            backgroundColor: colors.like,
            borderRadius: 25,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Heart size={20} color="white" fill="white" />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
              marginLeft: 8,
            }}
          >
            Like
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onMessage(user)}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: 25,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle size={20} color="white" />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
              marginLeft: 8,
            }}
          >
            Message
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
