import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { ChevronLeft, ShieldCheck, Database, MapPin, Share2, ServerOff } from 'lucide-react-native';

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
            Rideoxy does not transmit ride, speed, or GPS telemetry to remote servers. All telemetry and refuelling records reside strictly on your device.
          </Text>
        </View>

        {/* 1. Core Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Summary of Data Practices</Text>
          <Text style={styles.paragraph}>
            Rideoxy is designed as a secure, private, offline-first motorcycle riding companion:
          </Text>
          <View style={styles.pillarGrid}>
            <View style={styles.pillarItem}>
              <ServerOff size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pillarTitle}>No Accounts</Text>
                <Text style={styles.pillarSubtitle}>Zero registration, passwords, or emails required.</Text>
              </View>
            </View>

            <View style={styles.pillarItem}>
              <Database size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pillarTitle}>On-Device Storage</Text>
                <Text style={styles.pillarSubtitle}>All trackpoints and fuel logs reside exclusively in local SQLite.</Text>
              </View>
            </View>

            <View style={styles.pillarItem}>
              <Share2 size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pillarTitle}>No Tracking or Ads</Text>
                <Text style={styles.pillarSubtitle}>Contains zero analytics beacons, trackers, or telemetry brokers.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Location Access & Background Use */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Location Telemetry & Background Use</Text>
          <Text style={styles.paragraph}>
            Rideoxy accesses your device's high-precision GPS hardware strictly during recorded motorcycle trips:
          </Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <MapPin size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.boldText}>Foreground Location</Text>
                <Text style={styles.paragraph}>
                  Calculates real-time speed, total distance, moving duration, and live route lines on the active cockpit HUD.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <MapPin size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.boldText}>Background Location</Text>
                <Text style={styles.paragraph}>
                  Maintains continuous recording when the screen turns off or the phone is mounted in a pocket or bag.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <MapPin size={16} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.boldText}>Session Bound</Text>
                <Text style={styles.paragraph}>
                  Hardware location polling terminates immediately when you pause, finish, or discard your ride.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Ride Modes and Network Transmission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Ride Modes & Network Privacy</Text>
          <Text style={styles.paragraph}>
            Free Ride mode sends nothing over the network. Zero data is sent during or after the ride.
          </Text>
          <Text style={styles.paragraph}>
            Destination mode queries OpenStreetMap Nominatim when searching by name, or sets coordinates directly via map pin drop. For upfront route ETA estimates, start and destination coordinates are sent to Ola Directions (or OpenStreetMap OSRM when fallback is used). Free Ride sends nothing, and nothing is sent during or after the ride.
          </Text>
        </View>

        {/* 4. Local Storage & User Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Local Storage & Export Control</Text>
          <Text style={styles.paragraph}>
            Every trackpoint (latitude, longitude, speed, heading, timestamp) and fuel log is under your direct control:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Export any recorded ride as an open standard GPX file via the native share sheet.</Text>
            <Text style={styles.bulletItem}>• Delete individual rides or fuel entries at any time.</Text>
            <Text style={styles.bulletItem}>• Permanently purge all local databases via Settings.</Text>
          </View>
        </View>

        {/* 4. Map Providers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Map Providers & Tile Services</Text>
          <Text style={styles.paragraph}>
            To display maps, Rideoxy utilizes MapLibre Native, OpenFreeMap vector tile servers, and OpenStreetMap data. Your personal ride trajectories are rendered locally on-device and are never uploaded to tile providers.
          </Text>
        </View>

        {/* 6. Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Application Identity & Contact</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactText}><Text style={styles.boldText}>Application:</Text> Rideoxy (V1)</Text>
            <Text style={styles.contactText}><Text style={styles.boldText}>Developer:</Text> Namish Yadav</Text>
            <Text style={styles.contactText}><Text style={styles.boldText}>Contact:</Text> nam4sh@gmail.com</Text>
          </View>
        </View>

        <Text style={styles.effectiveDate}>Rideoxy · Privacy-first motorcycle telemetry · 2026</Text>
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
    paddingTop: 16,
    paddingBottom: 36,
  },
  banner: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 20,
    gap: 8,
  },
  bannerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  paragraph: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  pillarGrid: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
    gap: 12,
    marginTop: 6,
  },
  pillarItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pillarTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  pillarSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
    marginTop: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 8,
  },
  boldText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  bulletList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  bulletItem: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
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
    marginTop: 12,
    fontWeight: '600',
  },
});
