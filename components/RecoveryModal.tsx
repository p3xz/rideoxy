import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { Ride } from '../types/ride';
import { formatDistance, formatDuration } from '../services/distance';
import { AlertCircle, Play, Check, Trash2 } from 'lucide-react-native';

interface RecoveryModalProps {
  visible: boolean;
  ride: Ride | null;
  onResume: () => void;
  onEndAndSave: () => void;
  onDiscard: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  visible,
  ride,
  onResume,
  onEndAndSave,
  onDiscard,
}) => {
  if (!ride) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.iconContainer}>
            <AlertCircle size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Unfinished Ride Detected</Text>
          <Text style={styles.description}>
            A motorcycle ride was interrupted during your previous session.
          </Text>

          {/* Ride Overview */}
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>RECORDED DISTANCE</Text>
              <Text style={styles.statValue}>{formatDistance(ride.distance)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>TIME ELAPSED</Text>
              <Text style={styles.statValue}>{formatDuration(ride.duration)}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.resumeBtn]}
              onPress={onResume}
              activeOpacity={0.8}
            >
              <Play size={16} color="#0C0E12" fill="#0C0E12" />
              <Text style={styles.resumeBtnText}>RESUME RIDE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.saveBtn]}
              onPress={onEndAndSave}
              activeOpacity={0.8}
            >
              <Check size={16} color={Colors.text} />
              <Text style={styles.saveBtnText}>SAVE & FINISH</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.discardBtn]}
              onPress={onDiscard}
              activeOpacity={0.8}
            >
              <Trash2 size={15} color={Colors.danger} />
              <Text style={styles.discardBtnText}>DISCARD RIDE</Text>
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
    backgroundColor: 'rgba(8, 10, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  statsCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.surfaceBorder,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  buttonGroup: {
    width: '100%',
    gap: 8,
  },
  actionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeBtn: {
    backgroundColor: Colors.primary,
  },
  resumeBtnText: {
    color: '#0C0E12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  saveBtn: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  saveBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  discardBtn: {
    backgroundColor: 'transparent',
    height: 38,
  },
  discardBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
