import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { UI } from '../../constants/ui';
import { usePressScale } from '../../lib/motion';

interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Small emerald status chip next to the title. */
  badge?: string;
  right?: string;
  rightSecondary?: string;
  onPress?: () => void;
  showChevron?: boolean;
  /** `card` = standalone bordered card. `plain` = row inside a grouped Card. */
  variant?: 'card' | 'plain';
  /** Hairline under the row (plain variant). */
  divider?: boolean;
  accessibilityLabel?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  leading,
  title,
  subtitle,
  badge,
  right,
  rightSecondary,
  onPress,
  showChevron = true,
  variant = 'card',
  divider,
  accessibilityLabel,
}) => {
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.middle}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={styles.rightCol}>
          <Text style={styles.right} numberOfLines={1}>
            {right}
          </Text>
          {rightSecondary ? (
            <Text style={styles.rightSecondary} numberOfLines={1}>
              {rightSecondary}
            </Text>
          ) : null}
        </View>
      ) : null}
      {showChevron && onPress ? <ChevronRight size={17} color={UI.textMuted} strokeWidth={1.8} /> : null}
      {variant === 'plain' && divider ? <View style={styles.divider} /> : null}
    </>
  );

  const baseStyle = variant === 'card' ? styles.cardRow : styles.plainRow;

  const { animatedStyle, onPressIn, onPressOut } = usePressScale({ scaleTo: 0.98 });

  if (!onPress) {
    return <View style={baseStyle}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Animated.View style={[baseStyle, animatedStyle]}>
        {content}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: UI.cardBg,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    borderRadius: UI.cardRadius,
    marginBottom: 10,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: UI.accentSoft,
    borderWidth: 1,
    borderColor: UI.accentBorder,
  },
  badgeText: {
    color: UI.accent,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  rightCol: {
    alignItems: 'flex-end',
    maxWidth: '36%',
  },
  right: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rightSecondary: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: UI.hairline,
  },
});
