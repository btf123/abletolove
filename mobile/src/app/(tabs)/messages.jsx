import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MessageCircle, Search } from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

// Sample conversation data - this will come from the API later
const sampleConversations = [
  {
    id: 1,
    match_id: 1,
    profile: {
      id: 1,
      display_name: "Alex",
      photos: [
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
    },
    last_message: {
      content: "That sounds amazing! I'd love to try that trail sometime 📸",
      created_at: "2024-01-15T16:45:00Z",
      sender_name: "Alex",
    },
    unread_count: 3,
    is_online: true,
  },
  {
    id: 2,
    match_id: 2,
    profile: {
      id: 2,
      display_name: "Sam",
      photos: [
        "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
    },
    last_message: {
      content: "Thanks for sharing that! Your perspective is really inspiring 💜",
      created_at: "2024-01-15T14:20:00Z",
      sender_name: "You",
    },
    unread_count: 0,
    is_online: false,
  },
  {
    id: 3,
    match_id: 3,
    profile: {
      id: 3,
      display_name: "Jordan",
      photos: [
        "https://images.pexels.com/photos/1722198/pexels-photo-1722198.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
    },
    last_message: {
      content: "Hey! Nice to match with you 😊",
      created_at: "2024-01-14T19:30:00Z",
      sender_name: "Jordan",
    },
    unread_count: 1,
    is_online: true,
  },
  {
    id: 4,
    match_id: 4,
    profile: {
      id: 4,
      display_name: "Riley",
      photos: [
        "https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
    },
    last_message: {
      content: "Would love to chat more about accessible travel!",
      created_at: "2024-01-13T11:15:00Z",
      sender_name: "Riley",
    },
    unread_count: 0,
    is_online: false,
  },
];

function ConversationItem({ conversation, onPress }) {
  const { colors } = useTheme();
  const messageTime = getTimeSince(conversation.last_message.created_at);

  return (
    <TouchableOpacity
      onPress={() => onPress(conversation)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Profile Photo with Online Indicator */}
      <View style={{ position: "relative", marginRight: 16 }}>
        <Image
          source={{ uri: conversation.profile.photos[0] }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
          }}
        />
        {conversation.is_online && (
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.online,
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          />
        )}
      </View>

      {/* Message Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text
            style={{
              fontFamily: conversation.unread_count > 0 ? "Inter_600SemiBold" : "Inter_500Medium",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
          >
            {conversation.profile.display_name}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.textTertiary,
            }}
          >
            {messageTime}
          </Text>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              fontFamily: conversation.unread_count > 0 ? "Inter_500Medium" : "Inter_400Regular",
              fontSize: 14,
              color: conversation.unread_count > 0 ? colors.text : colors.textSecondary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {conversation.last_message.sender_name === "You" ? "You: " : ""}
            {conversation.last_message.content}
          </Text>
          
          {conversation.unread_count > 0 && (
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2,
                minWidth: 20,
                alignItems: "center",
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {conversation.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getTimeSince(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMins < 5) {
    return "now";
  } else if (diffInMins < 60) {
    return `${diffInMins}m`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else if (diffInDays === 1) {
    return "1d";
  } else if (diffInDays < 7) {
    return `${diffInDays}d`;
  } else {
    return new Date(dateString).toLocaleDateString();
  }
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [conversations, setConversations] = useState(sampleConversations);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const handleConversationPress = async (conversation) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to chat screen
    router.push(`/chat/${conversation.match_id}`);
  };

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 28,
                color: colors.text,
                marginBottom: 4,
              }}
            >
              Messages
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
              }}
            >
              {totalUnreadCount > 0 ? `${totalUnreadCount} unread messages` : "All caught up!"}
            </Text>
          </View>
          
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Search size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100, // Account for tab bar
        }}
        showsVerticalScrollIndicator={false}
      >
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onPress={handleConversationPress}
            />
          ))
        ) : (
          // Empty state
          <View
            style={{
              alignItems: "center",
              paddingTop: 80,
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
              <MessageCircle size={40} color={colors.primary} />
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
              No messages yet
            </Text>
            
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              Start conversations with your matches to see them here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}