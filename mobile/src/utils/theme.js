import { useColorScheme } from 'react-native';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  
  const colors = {
    light: {
      background: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceSecondary: '#F8F9FA',
      surfaceElevated: '#FFFFFF',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      textTertiary: 'rgba(26, 26, 26, 0.5)',
      border: '#E5E7EB',
      
      // Dating app specific colors
      primary: '#E91E63', // Pink for love/dating theme
      primaryLight: '#FCE4EC',
      primaryDark: '#C2185B',
      
      secondary: '#9C27B0', // Purple accent
      secondaryLight: '#F3E5F5',
      secondaryDark: '#7B1FA2',
      
      // Action colors
      like: '#4CAF50', // Green for like
      pass: '#F44336', // Red for pass
      match: '#FF9800', // Orange for match
      
      // Card colors
      cardBackground: '#FFFFFF',
      cardShadow: 'rgba(0, 0, 0, 0.1)',
      
      // Button colors
      primaryButton: '#E91E63',
      primaryButtonText: '#FFFFFF',
      secondaryButton: '#F8F9FA',
      secondaryButtonText: '#1A1A1A',
      
      // Chat colors
      messageOwn: '#E91E63',
      messageOwnText: '#FFFFFF',
      messageOther: '#F1F3F4',
      messageOtherText: '#1A1A1A',
      
      // Status colors
      online: '#4CAF50',
      offline: '#9E9E9E',
      warning: '#FF9800',
      error: '#F44336',
      success: '#4CAF50',
    },
    dark: {
      background: '#121212',
      surface: '#1E1E1E',
      surfaceSecondary: '#2A2A2A',
      surfaceElevated: '#2A2A2A',
      text: 'rgba(255, 255, 255, 0.87)',
      textSecondary: 'rgba(255, 255, 255, 0.6)',
      textTertiary: 'rgba(255, 255, 255, 0.38)',
      border: '#333333',
      
      // Dating app specific colors (darker)
      primary: '#F06292', // Lighter pink for dark mode
      primaryLight: '#4A2C3A',
      primaryDark: '#E91E63',
      
      secondary: '#BA68C8', // Lighter purple for dark mode
      secondaryLight: '#4A2D4A',
      secondaryDark: '#9C27B0',
      
      // Action colors
      like: '#66BB6A', // Lighter green for dark mode
      pass: '#EF5350', // Lighter red for dark mode
      match: '#FFB74D', // Lighter orange for dark mode
      
      // Card colors
      cardBackground: '#2A2A2A',
      cardShadow: 'rgba(0, 0, 0, 0.3)',
      
      // Button colors
      primaryButton: '#F06292',
      primaryButtonText: '#121212',
      secondaryButton: '#333333',
      secondaryButtonText: 'rgba(255, 255, 255, 0.87)',
      
      // Chat colors
      messageOwn: '#F06292',
      messageOwnText: '#121212',
      messageOther: '#333333',
      messageOtherText: 'rgba(255, 255, 255, 0.87)',
      
      // Status colors
      online: '#66BB6A',
      offline: '#757575',
      warning: '#FFB74D',
      error: '#EF5350',
      success: '#66BB6A',
    }
  };
  
  return {
    colors: colors[colorScheme] || colors.light,
    isDark: colorScheme === 'dark'
  };
};