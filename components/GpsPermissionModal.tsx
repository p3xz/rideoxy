import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Navigation, ShieldCheck, Zap, AlertTriangle, Settings2 } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { UI } from '../constants/ui';
import { hapticFeedback } from '../services/haptics';

export type GpsModalMode = 'explainer' | 'denied' | 'reduced_accuracy';

interface GpsPermissionModalProps {
  visible: boolean;
  mode: GpsModalMode;
  onContinue: () => void;
  onCancel: () => void;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  visible,
  mode,
  onContinue,
  onCancel,
}) => {
  const handlePrimary = () => {
    hapticFeedback.light();
    if (mode === 'denied' || mode === 'reduced_accuracy') {
      Linking.openSettings().catch(() => {});
      onCancel();
    } else {
      onContinue();
    }
  };

  const handleCancel = () => {
    hapticFeedback.light();
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              mode !== 'explainer' && styles.iconCircleWarning,
            ]}
          >
            {mode === 'explainer' ? (
              <Navigation size={28} color={Colors.primary} />
            ) : mode === 'reduced_accuracy' ? (
              <Zap size={28} color={Colors.warning} />
            ) : (
              <AlertTriangle size={28} color={Colors.warning} />
            )}
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            {mode === 'explainer'
              ? 'GPS & LOCATION PRIVACY'
              : mode === 'reduced_accuracy'
              ? 'PRECISE LOCATION REQUIRED'
              : 'LOCATION ACCESS NEEDED'}
          </Text>

          <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
            {mode === 'explainer'
              ? 'Rideoxy records your motorcycle rides with high precision. Your data stays 100% on your device.'
              : mode === 'reduced_accuracy'
              ? 'iOS Approximate Location is active. Precise location is required to calculate accurate speed, distance, and route maps.'
              : 'Location permission is turned off for Rideoxy. Enable location in iOS Settings to record rides.'}
          </Text>

          {/* Detailed Explanations for Initial Prompt */}
          {mode === 'explainer' && (
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <ShieldCheck size={18} color={Colors.primary} style={styles.featureIcon} />
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle} maxFontSizeMultiplier={1.3}>100% On-Device Telemetry</Text>
                  <Text style={styles.featureBody} maxFontSizeMultiplier={1.3}>
                    GPS coordinates are saved only in your phone's SQLite database. Never sent to any server.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Navigation size={18} color={Colors.secondary} style={styles.featureIcon} />
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle} maxFontSizeMultiplier={1.3}>Why "Always" Helps</Text>
                  <Text style={styles.featureBody} maxFontSizeMultiplier={1.3}>
                    Allows Rideoxy to keep recording without interruption when your screen turns off or you switch apps.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Zap size={18} color={Colors.textSecondary} style={styles.featureIcon} />
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle} maxFontSizeMultiplier={1.3}>"While Using" Still Works</Text>
                  <Text style={styles.featureBody} maxFontSizeMultiplier={1.3}>
                    If you prefer, select "While Using the App". Telemetry records whenever Rideoxy is active on screen.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handlePrimary}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={mode === 'explainer' ? 'Continue to iOS permission prompt' : 'Open iOS Settings'}
            >
              {mode !== 'explainer' && (
                <Settings2 size={18} color="#080A09" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.3}>
                {mode === 'explainer'
                  ? 'Continue'
                  : 'Open iOS Settings'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Dismiss location prompt"
            >
              <Text style={styles.secondaryBtnText} maxFontSizeMultiplier={1.3}>
                {mode === 'explainer' ? 'Not Now' : 'Dismiss'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F1512',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 230, 164, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleWarning: {
    backgroundColor: 'rgba(240, 200, 121, 0.12)',
    borderColor: 'rgba(240, 200, 121, 0.35)',
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    width: '100%',
    marginBottom: 20,
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureBody: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 16.5,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#080A09',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: UI.textSecondary,
    fontSize: 13.5,
    fontWeight: '500',
  },
});
