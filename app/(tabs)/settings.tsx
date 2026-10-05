import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { deleteAllRides } from '../../database/rideRepository';
import { Wordmark } from '../../components/svg/Wordmark';
import { InstagramIcon } from '../../components/svg/InstagramIcon';
import { MAP_ATTRIBUTION } from '../../constants/map';
import {
  Shield,
  Trash2,
  FileText,
  MapPin,
  Compass,
  ChevronRight,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [unitIsMiles, setUnitIsMiles] = useState(false);

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Rides',
      'Are you sure you want to permanently delete all recorded motorcycle rides from this device? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllRides();
              Alert.alert('Data Cleared', 'All local rides have been deleted.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete all rides.');
            }
          },
        },
      ]
    );
  };

  const showLocationUsageInfo = () => {
    Alert.alert(
      'Location Precision in Brovxi',
      'Brovxi uses precise device GPS location while a ride is being recorded. Background location is active solely during a recording session so your telemetry continues uninterrupted when your phone screen is off or mounted.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Wordmark size="md" showTagline={false} />
          <Text style={styles.headerTitle}>SETTINGS</Text>
          <Text style={styles.brandVersion}>v1.0.0 · Local-First Motorcycle Telemetry</Text>
        </View>

        {/* Section: Tracking */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TELEMETRY & SENSORS</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <Compass size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Distance Units</Text>
                  <Text style={styles.rowSubtitle}>
                    {unitIsMiles ? 'Miles & MPH' : 'Kilometers & KM/H (Default)'}
                  </Text>
                </View>
              </View>
              <Switch
                value={unitIsMiles}
                onValueChange={setUnitIsMiles}
                trackColor={{ false: Colors.surfaceBorder, true: Colors.primaryDark }}
                thumbColor={unitIsMiles ? Colors.primary : Colors.textSecondary}
              />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={showLocationUsageInfo}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <MapPin size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>GPS & Location Precision</Text>
                  <Text style={styles.rowSubtitle}>High accuracy telemetry & background recording</Text>
                </View>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Privacy & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & DATA</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/privacy')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <Shield size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Privacy Policy</Text>
                  <Text style={styles.rowSubtitle}>Local storage & offline telemetry disclosure</Text>
                </View>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>STORAGE MANAGEMENT</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleDeleteAll}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.dangerSurface }]}>
                  <Trash2 size={16} color={Colors.danger} />
                </View>
                <View>
                  <Text style={[styles.rowTitle, { color: Colors.danger }]}>Delete All Rides</Text>
                  <Text style={styles.rowSubtitle}>Permanently clear all SQLite ride records</Text>
                </View>
              </View>
              <ChevronRight size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Attribution & Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT & ATTRIBUTION</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('https://instagram.com/nam7sh')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(225, 48, 108, 0.12)' }]}>
                  <InstagramIcon size={16} color="#E1306C" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Developer Profile</Text>
                  <Text style={[styles.rowSubtitle, { color: Colors.primary }]}>
                    instagram.com/nam7sh
                  </Text>
                </View>
              </View>
              <ExternalLink size={14} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('https://github.com/p3xz')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                  <Github size={16} color={Colors.text} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>GitHub</Text>
                  <Text style={[styles.rowSubtitle, { color: Colors.primary }]}>
                    github.com/p3xz
                  </Text>
                </View>
              </View>
              <ExternalLink size={14} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('https://linkedin.com/in/namish-yadav-639769408')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(10, 102, 194, 0.12)' }]}>
                  <Linkedin size={16} color="#0A66C2" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>LinkedIn</Text>
                  <Text style={[styles.rowSubtitle, { color: Colors.primary }]}>
                    Namish Yadav
                  </Text>
                </View>
              </View>
              <ExternalLink size={14} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('https://namishhh.vercel.app')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <Globe size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Portfolio</Text>
                  <Text style={[styles.rowSubtitle, { color: Colors.primary }]}>
                    namishhh.vercel.app
                  </Text>
                </View>
              </View>
              <ExternalLink size={14} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.attributionBox}>
              <Text style={styles.attributionHeading}>Geospatial & Vector Tiles</Text>
              <Text style={styles.attributionBody}>
                {MAP_ATTRIBUTION.attributionNotice}
              </Text>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/licenses')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconCircle}>
                  <FileText size={16} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Third-Party Licenses</Text>
                  <Text style={styles.rowSubtitle}>Open source libraries and notices</Text>
                </View>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  brandVersion: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: 14,
  },
  attributionBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attributionHeading: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  attributionBody: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
