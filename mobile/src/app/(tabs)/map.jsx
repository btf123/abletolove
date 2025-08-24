import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, Alert, AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import { router } from "expo-router";
import useUser from "@/utils/auth/useUser";
import { useTheme } from "../../utils/theme";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as Haptics from "expo-haptics";

import { UserGridCard } from "../../components/map/UserGridCard";
import { UserMapMarker } from "../../components/map/UserMapMarker";
import { UserProfileModal } from "../../components/map/UserProfileModal";
import { FilterModal } from "../../components/map/FilterModal";
import { LocationPermissionScreen } from "../../components/map/LocationPermissionScreen";
import { LoadingScreen } from "../../components/map/LoadingScreen";
import { MapHeader } from "../../components/map/MapHeader";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const mapRef = useRef(null);
  const locationUpdateInterval = useRef(null);
  const [viewMode, setViewMode] = useState("map");
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLocationSharingEnabled, setIsLocationSharingEnabled] =
    useState(true);

  // Filter state
  const [filters, setFilters] = useState({
    ageMin: 18,
    ageMax: 50,
    maxDistance: 50,
    onlineOnly: false,
    recentlyActive: false,
    relationshipGoals: [],
    interests: [],
  });

  const [showFilterModal, setShowFilterModal] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Real-time location updates with 1-second refresh
  const { data: nearbyUsersData, refetch } = useQuery({
    queryKey: ["nearby-users-realtime", location],
    queryFn: async () => {
      if (!location || !isLocationSharingEnabled) return [];

      const params = new URLSearchParams({
        lat: location.latitude.toString(),
        lng: location.longitude.toString(),
        limit: "100",
        realtime: "true",
        ageMin: filters.ageMin.toString(),
        ageMax: filters.ageMax.toString(),
        maxDistance: filters.maxDistance.toString(),
      });

      const response = await fetch(`/api/profiles/nearby?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch nearby users");
      }
      const data = await response.json();

      return (data.profiles || []).map((profile) => ({
        id: profile.user_id,
        display_name: profile.display_name,
        age: profile.age,
        photos: profile.photos || [
          "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400",
        ],
        location: {
          latitude: parseFloat(profile.location_lat),
          longitude: parseFloat(profile.location_lng),
        },
        distance: profile.distance || 0,
        last_active: profile.last_active || "now",
        is_online: profile.is_online || Math.random() > 0.3,
        bio: profile.bio,
        interests: profile.interests || [],
        relationship_goals: profile.relationship_goals,
        updated_at: profile.updated_at,
      }));
    },
    enabled: !!user && !!location && isLocationSharingEnabled,
    refetchInterval: 1000, // Refresh every 1 second for real-time updates
    staleTime: 0, // Always consider data stale for real-time behavior
  });

  const nearbyUsers = nearbyUsersData || [];

  // Update user's own location in real-time
  const updateLocationMutation = useMutation({
    mutationFn: async (newLocation) => {
      const response = await fetch("/api/profiles/location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          share_location: isLocationSharingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update location");
      }
      return response.json();
    },
    onError: (error) => {
      console.error("Location update error:", error);
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch("/api/swipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swiped_user_id: userId,
          action: "like",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to like user");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.match) {
        Alert.alert(
          "🎉 It's a Match!",
          `You and ${data.match.profile?.name} liked each other!`,
          [
            { text: "Keep Exploring", style: "cancel" },
            {
              text: "Send Message",
              onPress: () => router.push(`/chat/${data.match.id}`),
            },
          ],
        );
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      } else {
        Alert.alert(
          "👍 Like Sent!",
          "If they like you back, you'll get a match!",
        );
      }
    },
    onError: (error) => {
      console.error("Like error:", error);
      Alert.alert("Error", "Failed to send like. Please try again.");
    },
  });

  useEffect(() => {
    requestLocationPermission();

    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === "active") {
        startLocationTracking();
      } else {
        stopLocationTracking();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (location && isLocationSharingEnabled) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => stopLocationTracking();
  }, [location, isLocationSharingEnabled]);

  const startLocationTracking = () => {
    if (locationUpdateInterval.current) return;

    locationUpdateInterval.current = setInterval(async () => {
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const newLocation = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };

        // Update location if it has changed significantly (>5 meters)
        if (location) {
          const distance = getDistanceBetweenPoints(
            location.latitude,
            location.longitude,
            newLocation.latitude,
            newLocation.longitude,
          );

          if (distance > 5) {
            // 5 meters threshold
            setLocation({
              ...newLocation,
              latitudeDelta: location.latitudeDelta,
              longitudeDelta: location.longitudeDelta,
            });
            updateLocationMutation.mutate(newLocation);
          }
        }
      } catch (error) {
        console.error("Error tracking location:", error);
      }
    }, 1000); // Update every second
  };

  const stopLocationTracking = () => {
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
      locationUpdateInterval.current = null;
    }
  };

  const getDistanceBetweenPoints = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);

      if (status === "granted") {
        getCurrentLocation();
      } else {
        setLoading(false);
        Alert.alert(
          "Location Permission Required",
          "To find people near you, please enable location access in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Settings",
              onPress: () => Location.requestForegroundPermissionsAsync(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setLocation(newLocation);
      updateLocationMutation.mutate(newLocation);
      setLoading(false);
    } catch (error) {
      console.error("Error getting current location:", error);
      setLoading(false);
      setLocation({
        latitude: 37.7849,
        longitude: -122.4094,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleUserPress = (userData) => {
    setSelectedUser(userData);
    setShowUserModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLike = async (userData) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowUserModal(false);
    likeMutation.mutate(userData.id);
  };

  const handleMessage = async (userData) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowUserModal(false);
    console.log("Message user:", userData.display_name);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "map" ? "grid" : "map");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  if (!fontsLoaded) {
    return null;
  }

  if (loading) {
    return <LoadingScreen message="Finding people near you..." />;
  }

  if (locationPermission !== "granted") {
    return (
      <LocationPermissionScreen onGrantPermission={requestLocationPermission} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <MapHeader
        insets={insets}
        nearbyUsersCount={nearbyUsers.length}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onShowFilters={() => setShowFilterModal(true)}
        isLocationSharingEnabled={isLocationSharingEnabled}
        onToggleLocationSharing={setIsLocationSharingEnabled}
      />

      {viewMode === "map" ? (
        <View style={{ flex: 1, position: "relative" }}>
          {location ? (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={location}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsPointsOfInterest={false}
              showsCompass={false}
              showsScale={false}
              showsBuildings={true}
              showsTraffic={false}
              loadingEnabled={true}
              loadingBackgroundColor={colors.background}
              mapType="standard"
              pitchEnabled={true}
              rotateEnabled={true}
              zoomEnabled={true}
              scrollEnabled={true}
            >
              {nearbyUsers.map((userData) => (
                <UserMapMarker
                  key={`${userData.id}-${userData.updated_at}`}
                  user={userData}
                  onPress={handleUserPress}
                />
              ))}
            </MapView>
          ) : (
            <LoadingScreen message="Loading real-time map..." />
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {nearbyUsers
            .sort((a, b) => a.distance - b.distance)
            .map((userData) => (
              <UserGridCard
                key={userData.id}
                user={userData}
                onPress={handleUserPress}
              />
            ))}
        </ScrollView>
      )}

      <UserProfileModal
        user={selectedUser}
        visible={showUserModal}
        onClose={() => setShowUserModal(false)}
        onLike={handleLike}
        onMessage={handleMessage}
      />

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApplyFilters={applyFilters}
      />
    </View>
  );
}
