import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import useUser from "@/utils/auth/useUser";
import { Heart, X, Settings, Info } from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  Directions,
} from "react-native-gesture-handler";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.7;
const SWIPE_THRESHOLD = screenWidth * 0.3;

// Sample data - this will come from the API later
const sampleProfiles = [
  {
    id: 1,
    display_name: "Alex",
    age: 28,
    bio: "Love hiking and photography. Looking for genuine connections.",
    disability_disclosure:
      "I use a wheelchair but that doesn't stop me from exploring the world!",
    location_name: "New York, NY",
    distance: 5,
    photos: [
      "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
      "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400",
    ],
    interests: ["photography", "hiking", "travel"],
  },
  {
    id: 2,
    display_name: "Sam",
    age: 32,
    bio: "Artist and coffee enthusiast. Let's create something beautiful together.",
    disability_disclosure:
      "I have a visual impairment but see the world in amazing ways.",
    location_name: "Brooklyn, NY",
    distance: 8,
    photos: [
      "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      "https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=400",
    ],
    interests: ["art", "coffee", "music"],
  },
  {
    id: 3,
    display_name: "Jordan",
    age: 25,
    bio: "Tech lover and gamer. Always up for a good conversation.",
    disability_disclosure:
      "I have cerebral palsy and love sharing my experiences.",
    location_name: "Jersey City, NJ",
    distance: 12,
    photos: [
      "https://images.pexels.com/photos/1722198/pexels-photo-1722198.jpeg?auto=compress&cs=tinysrgb&w=400",
    ],
    interests: ["gaming", "technology", "movies"],
  },
];

function SwipeCard({ profile, onSwipe, isTop }) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotate.value = event.translationX * 0.1;

      // Scale down slightly while dragging
      const progress = Math.abs(event.translationX) / SWIPE_THRESHOLD;
      scale.value = interpolate(progress, [0, 1], [1, 0.95], Extrapolate.CLAMP);
    })
    .onEnd((event) => {
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;

      if (shouldSwipeRight || shouldSwipeLeft) {
        // Animate off screen
        translateX.value = withTiming(
          shouldSwipeRight ? screenWidth : -screenWidth,
          { duration: 300 },
        );
        translateY.value = withTiming(event.translationY, { duration: 300 });
        rotate.value = withTiming(shouldSwipeRight ? 30 : -30, {
          duration: 300,
        });

        // Trigger haptic feedback
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);

        // Call onSwipe after animation
        setTimeout(() => {
          runOnJS(onSwipe)(profile.id, shouldSwipeRight ? "like" : "pass");
        }, 300);
      } else {
        // Spring back to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
        scale.value = withSpring(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.8],
      Extrapolate.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
        { scale: scale.value },
      ],
      opacity,
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP,
    ),
  }));

  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP,
    ),
  }));

  const nextPhoto = () => {
    if (currentPhotoIndex < profile.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: colors.cardBackground,
            borderRadius: 20,
            shadowColor: colors.cardShadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
            zIndex: isTop ? 2 : 1,
          },
          animatedStyle,
        ]}
      >
        {/* Photo */}
        <View style={{ flex: 1, borderRadius: 20, overflow: "hidden" }}>
          <Image
            source={{ uri: profile.photos[currentPhotoIndex] }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />

          {/* Photo navigation areas */}
          {profile.photos.length > 1 && (
            <>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: "transparent",
                }}
                onPress={prevPhoto}
                activeOpacity={1}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "50%",
                  height: "100%",
                  backgroundColor: "transparent",
                }}
                onPress={nextPhoto}
                activeOpacity={1}
              />
            </>
          )}

          {/* Photo indicators */}
          {profile.photos.length > 1 && (
            <View
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                right: 20,
                flexDirection: "row",
                gap: 4,
              }}
            >
              {profile.photos.map((_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 3,
                    backgroundColor:
                      index === currentPhotoIndex
                        ? "rgba(255, 255, 255, 0.9)"
                        : "rgba(255, 255, 255, 0.3)",
                    borderRadius: 2,
                  }}
                />
              ))}
            </View>
          )}

          {/* Like overlay */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 100,
                left: 30,
                padding: 10,
                backgroundColor: colors.like,
                borderRadius: 10,
                transform: [{ rotate: "-15deg" }],
              },
              likeOverlayStyle,
            ]}
          >
            <Text
              style={{
                color: "white",
                fontSize: 32,
                fontWeight: "bold",
                letterSpacing: 2,
              }}
            >
              LIKE
            </Text>
          </Animated.View>

          {/* Pass overlay */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 100,
                right: 30,
                padding: 10,
                backgroundColor: colors.pass,
                borderRadius: 10,
                transform: [{ rotate: "15deg" }],
              },
              passOverlayStyle,
            ]}
          >
            <Text
              style={{
                color: "white",
                fontSize: 32,
                fontWeight: "bold",
                letterSpacing: 2,
              }}
            >
              PASS
            </Text>
          </Animated.View>

          {/* Gradient overlay for text readability */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 200,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
              backgroundColor: "transparent",
            }}
          />

          {/* Profile info */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 28,
                  fontWeight: "bold",
                  marginRight: 8,
                }}
              >
                {profile.display_name}, {profile.age}
              </Text>
              <TouchableOpacity>
                <Info size={20} color="white" />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              📍 {profile.location_name} • {profile.distance} km away
            </Text>

            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 16,
                marginBottom: 8,
                lineHeight: 20,
              }}
              numberOfLines={2}
            >
              {profile.bio}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {profile.interests.slice(0, 3).map((interest, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 15,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 12 }}>
                    {interest}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Fetch nearby profiles from API
  const {
    data: profilesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["nearby-profiles"],
    queryFn: async () => {
      const response = await fetch("/api/profiles/nearby");
      if (!response.ok) {
        throw new Error("Failed to fetch profiles");
      }
      const data = await response.json();
      return data.profiles || sampleProfiles; // fallback to sample data
    },
    enabled: !!user, // only fetch if user is authenticated
  });

  // Swipe mutation
  const swipeMutation = useMutation({
    mutationFn: async ({ profileId, action }) => {
      const response = await fetch("/api/swipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swiped_user_id: profileId, // Updated to match backend API
          action,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record swipe");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Check if it's a match!
      if (data.match) {
        Alert.alert(
          "🎉 It's a Match!",
          `You and ${data.match.profile?.name} liked each other!`,
          [
            { text: "Keep Swiping", style: "cancel" },
            {
              text: "Send Message",
              onPress: () => {
                // TODO: Navigate to chat
              },
            },
          ],
        );

        // Invalidate matches to refresh the matches screen
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      }
    },
    onError: (error) => {
      console.error("Swipe error:", error);
      Alert.alert("Error", "Failed to record your swipe. Please try again.");
    },
  });

  const profiles = profilesData || [];

  const handleSwipe = useCallback(
    async (profileId, action) => {
      try {
        await swipeMutation.mutateAsync({ profileId, action });

        // Move to next card
        setCurrentIndex((prev) => prev + 1);

        // Fetch more profiles when running low (last 2 cards)
        if (currentIndex >= profiles.length - 2) {
          refetch();
        }
      } catch (error) {
        console.error("Swipe error:", error);
      }
    },
    [currentIndex, profiles.length, swipeMutation, refetch],
  );

  const handleLike = useCallback(async () => {
    if (currentIndex < profiles.length) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handleSwipe(profiles[currentIndex].id, "like");
    }
  }, [currentIndex, profiles, handleSwipe]);

  const handlePass = useCallback(async () => {
    if (currentIndex < profiles.length) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleSwipe(profiles[currentIndex].id, "pass");
    }
  }, [currentIndex, profiles, handleSwipe]);

  if (!fontsLoaded) {
    return null;
  }

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

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
            Discover
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.textSecondary,
            }}
          >
            Find your connection
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
          <Settings size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Cards Container */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: (screenWidth - CARD_WIDTH) / 2,
        }}
      >
        {currentIndex >= profiles.length ? (
          // No more profiles
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 24,
                color: colors.text,
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              No more profiles
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              Check back later for new people in your area
            </Text>
          </View>
        ) : (
          <>
            {/* Next card (behind) */}
            {nextProfile && (
              <SwipeCard
                profile={nextProfile}
                onSwipe={handleSwipe}
                isTop={false}
              />
            )}

            {/* Current card (on top) */}
            {currentProfile && (
              <SwipeCard
                profile={currentProfile}
                onSwipe={handleSwipe}
                isTop={true}
              />
            )}
          </>
        )}
      </View>

      {/* Action Buttons */}
      {currentIndex < profiles.length && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 40,
            paddingBottom: insets.bottom + 100, // Account for tab bar
            gap: 40,
          }}
        >
          {/* Pass Button */}
          <TouchableOpacity
            onPress={handlePass}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.pass,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.cardShadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <X size={28} color={colors.pass} />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity
            onPress={handleLike}
            style={{
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: colors.like,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.cardShadow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Heart size={32} color="white" fill="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
