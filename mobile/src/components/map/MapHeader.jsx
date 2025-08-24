import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../utils/theme";
import {
  Grid,
  Map as MapIcon,
  Filter,
  MapPin,
  EyeOff,
} from "lucide-react-native";

export function MapHeader({
  insets,
  nearbyUsersCount,
  viewMode,
  onToggleViewMode,
  onShowFilters,
  isLocationSharingEnabled,
  onToggleLocationSharing,
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        {/* Left side - Title and count */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 24,
              color: colors.text,
              marginBottom: 4,
            }}
          >
            Discover
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.online,
                marginRight: 6,
              }}
            />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {nearbyUsersCount} people nearby
            </Text>
          </View>
        </View>

        {/* Right side - Controls */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Location sharing toggle */}
          <TouchableOpacity
            onPress={onToggleLocationSharing}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isLocationSharingEnabled
                ? colors.primary
                : colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isLocationSharingEnabled
                ? colors.primary
                : colors.border,
            }}
          >
            {isLocationSharingEnabled ? (
              <MapPin size={20} color="white" />
            ) : (
              <EyeOff size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Filter button */}
          <TouchableOpacity
            onPress={onShowFilters}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Filter size={20} color={colors.text} />
          </TouchableOpacity>

          {/* View toggle button */}
          <TouchableOpacity
            onPress={onToggleViewMode}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {viewMode === "map" ? (
              <Grid size={20} color={colors.text} />
            ) : (
              <MapIcon size={20} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Location sharing status */}
      {!isLocationSharingEnabled && (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            backgroundColor: colors.warning + "20",
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: colors.warning,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.warning,
            }}
          >
            Location sharing is off. Others can't see you on the map.
          </Text>
        </View>
      )}
    </View>
  );
}
