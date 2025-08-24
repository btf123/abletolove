import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MessageCircle, Heart } from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/auth/useUser";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

const { width: screenWidth } = Dimensions.get("window");

// Sample matches data - this will come from the API later
const sampleMatches = [
  {
    id: 1,
    profile: {
      id: 1,
      display_name: "Alex",
      age: 28,
      photos: [
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
      location_name: "New York, NY",
      distance: 5,
    },
    matched_at: "2024-01-15T10:30:00Z",
    last_message: {
      content: "Hey! How's your photography going?",
      created_at: "2024-01-15T14:20:00Z",
      sender_name: "Alex",
    },
    unread_count: 2,
  },
  {
    id: 2,
    profile: {
      id: 2,
      display_name: "Sam",
      age: 32,
      photos: [
        "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
      location_name: "Brooklyn, NY",
      distance: 8,
    },
    matched_at: "2024-01-14T16:45:00Z",
    last_message: {
      content: "Would love to see your art sometime!",
      created_at: "2024-01-14T18:30:00Z",
      sender_name: "You",
    },
    unread_count: 0,
  },
  {
    id: 3,
    profile: {
      id: 3,
      display_name: "Jordan",
      age: 25,
      photos: [
        "https://images.pexels.com/photos/1722198/pexels-photo-1722198.jpeg?auto=compress&cs=tinysrgb&w=400",
      ],
      location_name: "Jersey City, NJ",
      distance: 12,
    },
    matched_at: "2024-01-13T09:15:00Z",
    last_message: null, // No messages yet
    unread_count: 0,
  },
];

function MatchCard({ match, onPress }) {
  const { colors } = useTheme();
  const timeSinceMatch = getTimeSince(match.matched_at);
  const lastMessageTime = match.last_message
    ? getTimeSince(match.last_message.created_at)
    : null;

  return (
    <TouchableOpacity
      onPress={() => onPress(match)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Profile Photo */}
      <View style={{ position: "relative" }}>
        <Image
          source={{ uri: match.profile.photos[0] }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
          }}
        />
        {/* Match indicator */}
        <View
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            backgroundColor: colors.match,
            borderRadius: 10,
            width: 20,
            height: 20,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        >
          <Heart size={10} color="white" fill="white" />
        </View>
      </View>

      {/* Profile Info */}
      <View style={{ flex: 1, marginLeft: 16 }}>
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
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
          >
            {match.profile.display_name}
          </Text>
          {match.unread_count > 0 && (
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2,
                minWidth: 20,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {match.unread_count}
              </Text>
            </View>
          )}
        </View>

        {match.last_message ? (
          <>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {match.last_message.sender_name === "You" ? "You: " : ""}
              {match.last_message.content}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: colors.textTertiary,
              }}
            >
              {lastMessageTime}
            </Text>
          </>
        ) : (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textTertiary,
              fontStyle: "italic",
            }}
          >
            Say hello! Matched {timeSinceMatch}
          </Text>
        )}
      </View>

      {/* Message Icon */}
      <TouchableOpacity
        style={{
          padding: 8,
          borderRadius: 20,
          backgroundColor: colors.primaryLight,
        }}
      >
        <MessageCircle size={20} color={colors.primary} />
      </TouchableOpacity>
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

  if (diffInMins < 60) {
    return `${diffInMins}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return `${diffInDays}d ago`;
  }
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: user } = useUser();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Fetch matches from API
  const { data: matchesData, isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const response = await fetch("/api/matches");
      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }
      const data = await response.json();
      return data.matches || sampleMatches; // fallback to sample data
    },
    enabled: !!user, // only fetch if user is authenticated
  });

  const matches = matchesData || [];

  const handleMatchPress = async (match) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to chat screen
    router.push(`/chat/${match.id}`);
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
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 28,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          Matches
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.textSecondary,
          }}
        >
          {matches.length} connections found
        </Text>
      </View>

      {/* Matches List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100, // Account for tab bar
        }}
        showsVerticalScrollIndicator={false}
      >
        {matches.length > 0 ? (
          matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={handleMatchPress}
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
              <Heart size={40} color={colors.primary} />
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
              No matches yet
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
              Keep swiping to find people who are interested in connecting with
              you
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
