import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { Colors } from '../constants/theme';
import { Play } from 'lucide-react-native';
import { hapticFeedback } from '../services/haptics';

interface StartRideButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const StartRideButton: React.FC<StartRideButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
}) => {
  const handlePress = () => {
    hapticFeedback.heavy();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.disabled]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={loading ? "Initializing GPS" : "Start motorcycle ride recording"}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Play size={18} color="#070909" fill="#070909" />
        </View>
        <Text style={styles.buttonText}>
          {loading ? 'INITIALIZING GPS...' : 'START RIDE'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(12, 14, 18, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  buttonText: {
    color: '#0C0E12',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
