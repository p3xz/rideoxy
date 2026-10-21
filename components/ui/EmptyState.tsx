import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { UI } from '../../constants/ui';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, actionLabel, onAction }) => (
  <View style={styles.wrap} accessible accessibilityLabel={`${title ? title + '. ' : ''}${message}`}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: UI.cardRadius,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: UI.accentSoft,
    borderWidth: 1,
    borderColor: UI.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    color: UI.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  action: {
    marginTop: 14,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#06140D',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
