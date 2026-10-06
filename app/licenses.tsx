import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { InstagramIcon } from '../components/svg/InstagramIcon';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

const LICENSES = [
  {
    name: 'MapLibre Native for React Native',
    license: 'BSD-3-Clause License',
    url: 'https://github.com/maplibre/maplibre-react-native',
    description: 'Open-source map rendering software engine for mobile devices.',
  },
  {
    name: 'OpenFreeMap',
    license: 'CC-BY 4.0 / Open Data',
    url: 'https://openfreemap.org',
    description: 'Free public vector tile hosting and map style provider (Liberty & Bright styles).',
  },
  {
    name: 'OpenStreetMap',
    license: 'Open Database License (ODbL) 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    description: 'Open-source geospatial map data contributed by the OpenStreetMap community. © OpenStreetMap contributors.',
  },
  {
    name: 'Expo & React Native',
    license: 'MIT License',
    url: 'https://github.com/expo/expo',
    description: 'Application framework and native runtime modules (Location, SQLite, TaskManager, Sharing).',
  },
  {
    name: 'React Native SVG',
    license: 'MIT License',
    url: 'https://github.com/software-mansion/react-native-svg',
    description: 'SVG rendering library for React Native.',
  },
  {
    name: 'Lucide Icons',
    license: 'ISC License',
    url: 'https://lucide.dev',
    description: 'Open-source iconography library.',
  },
];

export default function LicensesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>THIRD-PARTY LICENSES</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.leadText}>
          Rideoxy is built with the following open-source software libraries and map services:
        </Text>

        {/* Developer Credit Card */}
        <TouchableOpacity
          style={styles.devCard}
          onPress={() => Linking.openURL('https://instagram.com/nam7sh')}
          activeOpacity={0.7}
        >
          <View style={styles.devCardLeft}>
            <View style={styles.devIconCircle}>
              <InstagramIcon size={18} color="#E1306C" />
            </View>
            <View>
              <Text style={styles.devCardTitle}>Lead Developer</Text>
              <Text style={styles.devCardSubtitle}>Namish · instagram.com/nam7sh</Text>
            </View>
          </View>
          <ExternalLink size={14} color={Colors.primary} />
        </TouchableOpacity>

        {LICENSES.map((item, index) => (
          <View key={index} style={styles.licenseCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.packageName}>{item.name}</Text>
              <View style={styles.licenseBadge}>
                <Text style={styles.licenseBadgeText}>{item.license}</Text>
              </View>
            </View>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.urlText}>{item.url}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  leadText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  devCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  devCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  devIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(225, 48, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devCardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  devCardSubtitle: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  licenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 6,
  },
  packageName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  licenseBadge: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  licenseBadgeText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '700',
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  urlText: {
    color: Colors.textMuted,
    fontSize: 10,
  },
});
