import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, Flag, UserX } from "lucide-react-native";
import { useTheme } from "../../../utils/theme";
import useUser from "@/utils/auth/useUser";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

// Sample chat data - this will come from the API later
const sampleChat = {
  match_id: 1,
  profile: {
    id: 1,
    display_name: "Alex",
    photos: [
      "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
    ],
    is_online: true,
  },
  messages: [
    {
      id: 1,
      content: "Hey! I saw you love photography too. That's awesome! 📸",
      sender_id: 1,
      created_at: "2024-01-15T10:30:00Z",
      message_type: "text",
    },
    {
      id: 2,
      content: "Yes! I mostly do landscape and accessibility-focused shoots. What about you?",
      sender_id: 2, // Current user
      created_at: "2024-01-15T10:35:00Z",
      message_type: "text",
    },
    {
      id: 3,
      content: "That's amazing! I'd love to see some of your work sometime. I mostly do street photography and portraits.",
      sender_id: 1,
      created_at: "2024-01-15T10:40:00Z",
      message_type: "text",
    },
    {
      id: 4,
      content: "I actually have some photos from a recent accessible hiking trail. The views were incredible!",
      sender_id: 2,
      created_at: "2024-01-15T10:45:00Z",
      message_type: "text",
    },
    {
      id: 5,
      content: "That sounds amazing! I'd love to try that trail sometime 📸",
      sender_id: 1,
      created_at: "2024-01-15T16:45:00Z",
      message_type: "text",
    },
  ],
};

function Message({ message, isOwnMessage, partnerName }) {
  const { colors } = useTheme();
  const messageTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View
      style={{
        alignSelf: isOwnMessage ? "flex-end" : "flex-start",
        maxWidth: "80%",
        marginBottom: 12,
      }}
    >
      <View
        style={{
          backgroundColor: isOwnMessage ? colors.messageOwn : colors.messageOther,
          borderRadius: 18,
          borderBottomRightRadius: isOwnMessage ? 4 : 18,
          borderBottomLeftRadius: isOwnMessage ? 18 : 4,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: isOwnMessage ? colors.messageOwnText : colors.messageOtherText,
            lineHeight: 22,
          }}
        >
          {message.content}
        </Text>
      </View>
      
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 12,
          color: colors.textTertiary,
          marginTop: 4,
          textAlign: isOwnMessage ? "right" : "left",
        }}
      >
        {messageTime}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: user } = useUser();
  const [chat, setChat] = useState(sampleChat);
  const [message, setMessage] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const scrollViewRef = useRef(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    // Scroll to bottom when component mounts or messages change
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chat.messages]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Add message to chat
    const newMessage = {
      id: Date.now(),
      content: message.trim(),
      sender_id: 2, // Current user ID
      created_at: new Date().toISOString(),
      message_type: "text",
    };

    setChat(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));

    setMessage("");

    // TODO: Send to backend
    console.log("Sending message:", newMessage);
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleOptionsPress = () => {
    setShowOptions(!showOptions);
  };

  const handleReport = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowOptions(false);
    // TODO: Implement report functionality
    console.log("Report user");
  };

  const handleBlock = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowOptions(false);
    // TODO: Implement block functionality
    console.log("Block user");
  };

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
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>

          <Image
            source={{ uri: chat.profile.photos[0] }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
            }}
          />

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.text,
              }}
            >
              {chat.profile.display_name}
            </Text>
            {chat.profile.is_online && (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.online,
                }}
              >
                Online
              </Text>
            )}
          </View>
        </View>

        <View style={{ position: "relative" }}>
          <TouchableOpacity
            onPress={handleOptionsPress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MoreVertical size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {showOptions && (
            <View
              style={{
                position: "absolute",
                top: 45,
                right: 0,
                backgroundColor: colors.surface,
                borderRadius: 12,
                shadowColor: colors.cardShadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 8,
                minWidth: 160,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <TouchableOpacity
                onPress={handleReport}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Flag size={16} color={colors.warning} />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: colors.warning,
                    marginLeft: 12,
                  }}
                >
                  Report User
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBlock}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <UserX size={16} color={colors.error} />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: colors.error,
                    marginLeft: 12,
                  }}
                >
                  Block User
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
        showsVerticalScrollIndicator={false}
        onTouchStart={() => setShowOptions(false)}
      >
        {chat.messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            isOwnMessage={msg.sender_id === 2} // Assuming current user ID is 2
            partnerName={chat.profile.display_name}
          />
        ))}
      </ScrollView>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
              maxHeight: 100,
            }}
          >
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.text,
                lineHeight: 22,
              }}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
          </View>

          <TouchableOpacity
            onPress={sendMessage}
            disabled={!message.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: message.trim() ? colors.primary : colors.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send 
              size={20} 
              color={message.trim() ? "white" : colors.textTertiary} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}