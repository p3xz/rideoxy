import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { UI } from '../../constants/ui';
import { Colors } from '../../constants/theme';

interface InfoSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

/** Bottom sheet used for dropdowns, action menus, preferences and "Coming soon" states. */
export const InfoSheet: React.FC<InfoSheetProps> = ({ visible, title, subtitle, onClose, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}>
            <X size={17} color={UI.textSecondary} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

interface SheetActionProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

export const SheetAction: React.FC<SheetActionProps> = ({
  icon,
  label,
  description,
  onPress,
  destructive,
  selected,
  disabled,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }]}
  >
    {icon ? <View style={styles.actionIcon}>{icon}</View> : null}
    <View style={{ flex: 1 }}>
      <Text style={[styles.actionLabel, destructive && { color: Colors.danger }]}>{label}</Text>
      {description ? <Text style={styles.actionDesc}>{description}</Text> : null}
    </View>
    {selected ? <Check size={17} color={UI.accent} strokeWidth={2.4} /> : null}
  </Pressable>
);

/** Section label inside a sheet. */
export const SheetLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.sheetLabel}>{children}</Text>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 6, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0E1411',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.15)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '86%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.hairline,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  sheetLabel: {
    color: UI.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 14,
    marginBottom: 8,
  },
});
