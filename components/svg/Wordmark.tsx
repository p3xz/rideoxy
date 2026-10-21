import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Logo } from './Logo';
import { Colors } from '../../constants/theme';

interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Wordmark: React.FC<WordmarkProps> = ({
  size = 'md',
  showTagline = true,
}) => {
  const logoSize = size === 'lg' ? 38 : size === 'md' ? 28 : 20;
  const titleSize = size === 'lg' ? 22 : size === 'md' ? 18 : 15;
  const subtitleSize = size === 'lg' ? 10 : size === 'md' ? 9 : 8;

  return (
    <View style={styles.container}>
      <Logo size={logoSize} />
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.brandText, { fontSize: titleSize }]}>
            Ride<Text style={{ color: Colors.primary }}>oxy</Text>
          </Text>
          <View style={styles.accentDot} />
        </View>
        {showTagline && (
          <Text style={[styles.taglineText, { fontSize: subtitleSize }]}>
            MOTORCYCLE TELEMETRY
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandText: {
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  accentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginLeft: 3,
    marginBottom: 2,
  },
  taglineText: {
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
    fontSize: 8.5,
  },
});
