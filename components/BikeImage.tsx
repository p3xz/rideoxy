import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  StyleProp,
  ViewStyle,
  ImageStyle,
  ImageSourcePropType,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Colors } from '../constants/theme';

export const STOCK_GARAGE_IMAGE = require('../assets/images/garage-hero.jpg');

/**
 * Launches either the camera or media library with a 16:10 crop aspect ratio and 0.8 quality.
 * Requests camera permission ONLY when 'camera' is selected and shows a friendly message if denied.
 */
export async function launchBikePhotoSource(
  source: 'camera' | 'gallery'
): Promise<string | null> {
  try {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in your device settings to take a photo of your motorcycle.'
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Permission Needed',
          'Please allow photo library access to choose a photo of your motorcycle.'
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    }
  } catch (err) {
    console.warn('[Rideoxy] Image picker error:', err);
    Alert.alert('Photo Error', 'Unable to open photo picker on this device.');
    return null;
  }
}

/**
 * Opens an action sheet ("Take photo" / "Choose from gallery") and resolves with the selected URI.
 */
export function promptBikePhotoPicker(onPicked: (uri: string) => void): void {
  Alert.alert(
    'Motorcycle Photo',
    'Choose how you want to add your motorcycle photo (16:10 crop)',
    [
      {
        text: 'Take photo',
        onPress: async () => {
          const uri = await launchBikePhotoSource('camera');
          if (uri) onPicked(uri);
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const uri = await launchBikePhotoSource('gallery');
          if (uri) onPicked(uri);
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}

export interface BikeImageProps {
  photoUri?: string | null;
  variant?: 'hero' | 'card' | 'shortcut';
  fallbackSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  showStockBadge?: boolean;
  showAddPromptChip?: boolean;
  onPressAddPhoto?: () => void;
}

/**
 * Single reusable motorcycle image renderer (`BikeImage`):
 * - If `photoUri` exists: renders the user's real motorcycle photo with cover fit, centered,
 *   never showing the stock fallback or stock badges.
 * - If `photoUri` does not exist: renders the dimmed fallback placeholder with a subtle
 *   "Stock image" badge and optional tappable "📷 Add your bike's photo" prompt chip.
 */
export const BikeImage: React.FC<BikeImageProps> = ({
  photoUri,
  variant = 'card',
  fallbackSource = STOCK_GARAGE_IMAGE,
  style,
  imageStyle,
  showStockBadge = variant !== 'shortcut',
  showAddPromptChip = false,
  onPressAddPhoto,
}) => {
  const hasUserPhoto = !!(photoUri && photoUri.trim().length > 0);

  if (variant === 'shortcut') {
    const src: ImageSourcePropType = hasUserPhoto
      ? { uri: photoUri!.trim() }
      : fallbackSource;
    return (
      <Image
        source={src}
        style={imageStyle}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.container, style]}>
      {hasUserPhoto ? (
        <Image
          source={{ uri: photoUri!.trim() }}
          style={[styles.fullImage, imageStyle]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <>
          <Image
            source={fallbackSource}
            style={[
              styles.fullImage,
              variant === 'hero' ? styles.dimmedHero : styles.dimmedCard,
              imageStyle,
            ]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          {showStockBadge && (
            <View
              pointerEvents="none"
              style={[
                styles.stockBadge,
                variant === 'hero' ? styles.stockBadgeHero : styles.stockBadgeCard,
              ]}
            >
              <Text
                style={[
                  styles.stockBadgeText,
                  variant === 'card' && styles.stockBadgeTextSmall,
                ]}
              >
                Stock image
              </Text>
            </View>
          )}
        </>
      )}

      {!hasUserPhoto && showAddPromptChip && onPressAddPhoto ? (
        <Pressable
          onPress={onPressAddPhoto}
          accessibilityRole="button"
          accessibilityLabel="Add your bike's photo"
          hitSlop={8}
          style={({ pressed }) => [
            styles.promptChip,
            variant === 'card' && styles.promptChipCard,
            pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Camera size={12} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.promptChipText}>📷 Add your bike's photo</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C1210',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  dimmedHero: {
    opacity: 0.45,
  },
  dimmedCard: {
    opacity: 0.48,
  },
  stockBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(10, 14, 12, 0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stockBadgeHero: {
    top: 72,
    right: 20,
  },
  stockBadgeCard: {
    bottom: 5,
    left: 5,
  },
  stockBadgeText: {
    color: Colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stockBadgeTextSmall: {
    fontSize: 8,
  },
  promptChip: {
    position: 'absolute',
    bottom: 38,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 34, 24, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.42)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  promptChipCard: {
    bottom: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promptChipText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
