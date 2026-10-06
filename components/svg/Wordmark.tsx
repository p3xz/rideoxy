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
  const logoSize = size === 'lg' ? 42 : size === 'md' ? 32 : 24;
  const titleSize = size === 'lg' ? 24 : size === 'md' ? 20 : 16;
  const subtitleSize = size === 'lg' ? 11 : size === 'md' ? 10 : 9;

  return (
    <View style={styles.container}>
      <Logo size={logoSize} />
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.brandText, { fontSize: titleSize }]}>Rideoxy</Text>
          <View style={styles.accentDot} />
        </View>
        {showTagline && (
          <Text style={[styles.taglineText, { fontSize: subtitleSize }]}>
            Motorcycle Telemetry & Log
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
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  accentDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginLeft: 3,
    marginBottom: 2,
  },
  taglineText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 1,
  },
});
