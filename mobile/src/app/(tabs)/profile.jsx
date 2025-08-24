import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import useUser from "@/utils/auth/useUser";
import {
  Settings,
  Edit,
  Heart,
  MapPin,
  Calendar,
  LogOut,
} from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

// Sample profile data - this will come from the API later
const sampleProfile = {
  id: 1,
  display_name: "Taylor",
  age: 26,
  bio: "Adventurous spirit with a love for accessible travel and meaningful connections. Let's explore the world together!",
  disability_disclosure:
    "I'm proud to use a prosthetic leg - it doesn't slow me down one bit! Always happy to share experiences about navigating life with a disability.",
  location_name: "San Francisco, CA",
  photos: [
    "https://images.pexels.com/photos/6584748/pexels-photo-6584748.jpeg?auto=compress&cs=tinysrgb&w=400",
    "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400",
    "https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=400",
  ],
  interests: [
    "travel",
    "hiking",
    "photography",
    "accessibility advocacy",
    "cooking",
    "reading",
  ],
  relationship_goals: "serious",
  created_at: "2024-01-01T00:00:00Z",
};

function ProfileSection({ title, children }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 18,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function InterestTag({ interest }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.primaryLight,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 14,
          color: colors.primary,
        }}
      >
        {interest}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { signOut, signIn } = useAuth();
  const { data: user } = useUser();
  const [profile, setProfile] = useState(sampleProfile);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    signOut();
  };

  const handleEditProfile = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to edit profile screen
    console.log("Edit profile pressed");
  };

  if (!fontsLoaded) {
    return null;
  }

  if (!user) {
    // Show sign in prompt
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
            Welcome to Able To Love
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
            Sign in to create your profile and start connecting with amazing
            people
          </Text>

          <TouchableOpacity
            onPress={() => signIn()}
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
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 28,
              color: colors.text,
            }}
          >
            My Profile
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.textSecondary,
            }}
          >
            {user?.email}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={handleEditProfile}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Edit size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100, // Account for tab bar
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photos */}
        <ProfileSection title="Photos">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {profile.photos.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={{
                  width: 120,
                  height: 160,
                  borderRadius: 12,
                }}
              />
            ))}
            {/* Add photo placeholder */}
            <TouchableOpacity
              style={{
                width: 120,
                height: 160,
                borderRadius: 12,
                backgroundColor: colors.surfaceSecondary,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: colors.border,
                borderStyle: "dashed",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 24,
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}
              >
                +
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                Add Photo
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </ProfileSection>

        {/* Basic Info */}
        <ProfileSection title="Basic Info">
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Calendar size={20} color={colors.textSecondary} />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.text,
                  marginLeft: 12,
                }}
              >
                {profile.display_name}, {profile.age}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={20} color={colors.textSecondary} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 16,
                  color: colors.textSecondary,
                  marginLeft: 12,
                }}
              >
                {profile.location_name}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Heart size={20} color={colors.textSecondary} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 16,
                  color: colors.textSecondary,
                  marginLeft: 12,
                }}
              >
                Looking for {profile.relationship_goals} relationships
              </Text>
            </View>
          </View>
        </ProfileSection>

        {/* Bio */}
        <ProfileSection title="About Me">
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              lineHeight: 24,
            }}
          >
            {profile.bio}
          </Text>
        </ProfileSection>

        {/* Disability Disclosure */}
        <ProfileSection title="My Story">
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              lineHeight: 24,
            }}
          >
            {profile.disability_disclosure}
          </Text>
        </ProfileSection>

        {/* Interests */}
        <ProfileSection title="Interests">
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {profile.interests.map((interest, index) => (
              <InterestTag key={index} interest={interest} />
            ))}
          </View>
        </ProfileSection>

        {/* Settings */}
        <ProfileSection title="Settings">
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
            }}
          >
            <Settings size={20} color={colors.textSecondary} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 16,
                color: colors.text,
                marginLeft: 12,
                flex: 1,
              }}
            >
              Privacy & Safety
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              →
            </Text>
          </TouchableOpacity>
        </ProfileSection>
      </ScrollView>
    </View>
  );
}
