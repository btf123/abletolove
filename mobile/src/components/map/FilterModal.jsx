import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import * as Haptics from "expo-haptics";

export function FilterModal({ visible, onClose, filters, onApplyFilters }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = (key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setLocalFilters({
      ageMin: 18,
      ageMax: 50,
      maxDistance: 50,
      onlineOnly: false,
      recentlyActive: false,
      relationshipGoals: [],
      interests: [],
    });
  };

  const applyFilters = () => {
    onApplyFilters(localFilters);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const relationshipOptions = [
    "Serious relationship",
    "Something casual",
    "New friends",
    "Long-term partner",
    "Short-term fun",
  ];

  const interestOptions = [
    "Travel",
    "Music",
    "Sports",
    "Art",
    "Food",
    "Movies",
    "Books",
    "Gaming",
    "Fitness",
    "Photography",
    "Dancing",
    "Hiking",
    "Cooking",
    "Technology",
  ];

  const toggleArrayFilter = (array, item) => {
    return array.includes(item)
      ? array.filter((i) => i !== item)
      : [...array, item];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 18,
              color: colors.text,
            }}
          >
            Filters
          </Text>

          <TouchableOpacity onPress={resetFilters}>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 16,
                color: colors.primary,
              }}
            >
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Age Range */}
          <View style={{ padding: 20 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Age Range
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.textSecondary,
                }}
              >
                {localFilters.ageMin} - {localFilters.ageMax} years
              </Text>
            </View>

            {/* Age Controls */}
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  Min Age
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      updateFilter(
                        "ageMin",
                        Math.max(18, localFilters.ageMin - 1),
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceSecondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.text }}>-</Text>
                  </TouchableOpacity>

                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 18,
                      color: colors.text,
                      minWidth: 30,
                      textAlign: "center",
                    }}
                  >
                    {localFilters.ageMin}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      updateFilter(
                        "ageMin",
                        Math.min(
                          localFilters.ageMax - 1,
                          localFilters.ageMin + 1,
                        ),
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceSecondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.text }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  Max Age
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      updateFilter(
                        "ageMax",
                        Math.max(
                          localFilters.ageMin + 1,
                          localFilters.ageMax - 1,
                        ),
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceSecondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.text }}>-</Text>
                  </TouchableOpacity>

                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 18,
                      color: colors.text,
                      minWidth: 30,
                      textAlign: "center",
                    }}
                  >
                    {localFilters.ageMax}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      updateFilter(
                        "ageMax",
                        Math.min(99, localFilters.ageMax + 1),
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceSecondary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.text }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Distance */}
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Maximum Distance
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.textSecondary,
                }}
              >
                Up to {localFilters.maxDistance} km away
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  updateFilter(
                    "maxDistance",
                    Math.max(1, localFilters.maxDistance - 5),
                  )
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>-</Text>
              </TouchableOpacity>

              <View style={{ flex: 1, alignItems: "center" }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 18,
                    color: colors.text,
                  }}
                >
                  {localFilters.maxDistance} km
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  updateFilter(
                    "maxDistance",
                    Math.min(500, localFilters.maxDistance + 5),
                  )
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Activity Filters */}
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Activity
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                Show only online users
              </Text>
              <Switch
                value={localFilters.onlineOnly}
                onValueChange={(value) => updateFilter("onlineOnly", value)}
                trackColor={{
                  false: colors.surfaceSecondary,
                  true: colors.primary + "40",
                }}
                thumbColor={
                  localFilters.onlineOnly
                    ? colors.primary
                    : colors.textSecondary
                }
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                Recently active (last 24h)
              </Text>
              <Switch
                value={localFilters.recentlyActive}
                onValueChange={(value) => updateFilter("recentlyActive", value)}
                trackColor={{
                  false: colors.surfaceSecondary,
                  true: colors.primary + "40",
                }}
                thumbColor={
                  localFilters.recentlyActive
                    ? colors.primary
                    : colors.textSecondary
                }
              />
            </View>

            {/* Relationship Goals */}
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Looking For
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {relationshipOptions.map((goal) => (
                <TouchableOpacity
                  key={goal}
                  onPress={() =>
                    updateFilter(
                      "relationshipGoals",
                      toggleArrayFilter(localFilters.relationshipGoals, goal),
                    )
                  }
                  style={{
                    backgroundColor: localFilters.relationshipGoals.includes(
                      goal,
                    )
                      ? colors.primary
                      : colors.surfaceSecondary,
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: localFilters.relationshipGoals.includes(goal)
                        ? "white"
                        : colors.text,
                    }}
                  >
                    {goal}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interests */}
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 18,
                color: colors.text,
                marginBottom: 16,
              }}
            >
              Interests
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 40,
              }}
            >
              {interestOptions.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  onPress={() =>
                    updateFilter(
                      "interests",
                      toggleArrayFilter(localFilters.interests, interest),
                    )
                  }
                  style={{
                    backgroundColor: localFilters.interests.includes(interest)
                      ? colors.primary
                      : colors.surfaceSecondary,
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: localFilters.interests.includes(interest)
                        ? "white"
                        : colors.text,
                    }}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View
          style={{
            padding: 20,
            paddingBottom: insets.bottom + 20,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={applyFilters}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 25,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Check size={20} color="white" />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: "white",
                marginLeft: 8,
              }}
            >
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
