import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { UI } from '../../constants/ui';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionLabel, onAction }) => (
  <View style={styles.row}>
    <Text style={styles.title} accessibilityRole="header">
      {title}
    </Text>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
        <ChevronRight size={15} color={UI.textSecondary} strokeWidth={1.8} />
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    color: UI.textSecondary,
    fontSize: 13,
  },
});
