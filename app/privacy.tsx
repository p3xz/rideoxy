import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PRIVACY POLICY</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          <ShieldCheck size={28} color={Colors.primary} />
          <Text style={styles.bannerTitle}>Local-First Motorcycle Telemetry</Text>
          <Text style={styles.bannerSubtitle}>
            Rideoxy does not transmit ride or GPS telemetry to remote cloud servers in V1. Your riding records reside exclusively on this device.
          </Text>
        </View>

        {/* 1. Core Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Summary of Data Practices</Text>
          <Text style={styles.paragraph}>
            Rideoxy is built as a focused, offline-first motorcycle ride recorder:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• <Text style={styles.boldText}>No Accounts:</Text> You do not need to register, provide an email, or sign in to use the app.</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.boldText}>No Cloud Database:</Text> All recorded trackpoints, speeds, timestamps, and personal records reside exclusively in your device's local SQLite database.</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.boldText}>No Advertising:</Text> Rideoxy contains no third-party advertising SDKs or tracking pixels.</Text>
            <Text style={styles.bulletItem}>• <Text style={styles.boldText}>No Telemetry Selling:</Text> Your location history is never sold, shared, or monetized.</Text>
          </View>
        </View>

        {/* 2. Location Access & Background Use */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Location Telemetry & Background Use</Text>
          <Text style={styles.paragraph}>
            Rideoxy accesses your device's GPS receiver while recording a motorcycle trip:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.boldText}>Foreground Location:</Text> Used to calculate real-time speed, total distance, moving time, and live route lines on the active cockpit map.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.boldText}>Background Location:</Text> Used during an active ride so your route continues recording when your phone screen is locked or mounted.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.boldText}>Immediate Termination:</Text> Location recording stops immediately when you pause or finish your ride.
          </Text>
        </View>

        {/* 3. Local Storage & User Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Local Storage & Control</Text>
          <Text style={styles.paragraph}>
            Every trackpoint (latitude, longitude, speed, heading, timestamp) is stored locally in SQLite.
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• You can export individual rides as standardized GPX files.</Text>
            <Text style={styles.bulletItem}>• You can delete individual rides at any time.</Text>
            <Text style={styles.bulletItem}>• You can permanently erase all recorded rides via Settings.</Text>
          </View>
        </View>

        {/* 4. Map Providers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Map Providers & Tile Services</Text>
          <Text style={styles.paragraph}>
            To display maps, Rideoxy utilizes MapLibre Native, OpenFreeMap vector tile hosting, and OpenStreetMap data. No personal ride tracks are sent to map tile providers.
          </Text>
        </View>

        {/* 5. Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Developer & Contact</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactText}><Text style={styles.boldText}>Application:</Text> Rideoxy (V1)</Text>
            <Text style={styles.contactText}><Text style={styles.boldText}>Developer:</Text> Namish Yadav</Text>
            <Text style={styles.contactText}><Text style={styles.boldText}>Contact:</Text> nam4sh@gmail.com</Text>
          </View>
        </View>

        <Text style={styles.effectiveDate}>Last updated: 2026</Text>
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
  banner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 18,
  },
  bannerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  bannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  paragraph: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  boldText: {
    color: Colors.text,
    fontWeight: '700',
  },
  bulletList: {
    paddingLeft: 4,
    gap: 6,
    marginBottom: 8,
  },
  bulletItem: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 4,
    marginTop: 4,
  },
  contactText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  effectiveDate: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});
