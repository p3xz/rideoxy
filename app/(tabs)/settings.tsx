import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, Linking, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { getDatabaseSize } from '../../database/database';
import { hapticFeedback } from '../../services/haptics';
import {
  isGpsLoggingEnabled,
  setGpsLoggingEnabled,
  getFormattedGpsDebugLogs as getFormattedGpsLogs,
  getGpsDebugLogCount as getGpsLogCount,
  clearGpsDebugLogs as clearGpsDiagnosticLogs,
} from '../../services/gpsDebugLog';
import {
  User,
  SlidersHorizontal,
  MapPin,
  Database,
  CircleHelp,
  Info,
  Shield,
  FileText,
  Download,
  CloudUpload,
  Trash2,
  Fuel,
  Settings2,
  Clock,
  FileCode,
  Copy,
  Activity,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { UI } from '../../constants/ui';
import { MAP_ATTRIBUTION } from '../../constants/map';
import { deleteAllRides } from '../../database/rideRepository';
import { deleteAllFuelLogs } from '../../database/fuelRepository';
import { isExperimentalEnabled, setExperimentalEnabled } from '../../database/settingsRepository';
import { InstagramIcon } from '../../components/svg/InstagramIcon';
import { useTabBarHeight } from '../../components/FloatingTabBar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { ListRow } from '../../components/ui/ListRow';
import { InfoSheet, SheetAction, SheetLabel } from '../../components/ui/InfoSheet';
import { PreferencesPanel } from '../../components/settings/PreferencesPanel';
import { FadeInUpView } from '../../lib/motion';

type SheetKey = 'profile' | 'prefs' | 'location' | 'data' | 'help' | 'about' | 'backup' | 'diagnostics' | null;

const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER: string = Constants.expoConfig?.ios?.buildNumber ?? '1';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where is my data stored?',
    a: 'Only on this device, in a local database. Rideoxy has no accounts, no cloud sync and no trackers.',
  },
  {
    q: 'How do I export a ride?',
    a: 'Open a ride from My Rides and use the GPX export button. The file opens in your device share sheet.',
  },
  {
    q: 'Why does Rideoxy use background location?',
    a: 'Only while a ride is recording, so your route continues when the screen is off or the phone is mounted.',
  },
  {
    q: 'How do I switch km / miles or litres / gallons?',
    a: 'Open App Preferences on this screen. Fuel, Rides, Stats and Garage all follow your choice.',
  },
];

const IconBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.bubble}>{children}</View>
);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [gpsLogging, setGpsLogging] = useState<boolean>(isGpsLoggingEnabled());
  const [logCount, setLogCount] = useState<number>(getGpsLogCount());
  const [experimentalEnabled, setExperimentalEnabledState] = useState<boolean>(false);

  React.useEffect(() => {
    isExperimentalEnabled().then(setExperimentalEnabledState).catch(() => {});
  }, []);

  const toggleExperimental = async (enabled: boolean) => {
    hapticFeedback.light();
    setExperimentalEnabledState(enabled);
    await setExperimentalEnabled(enabled);
  };

  const iconProps = { size: 20, color: UI.textPrimary, strokeWidth: 1.6 } as const;
  const close = () => setSheet(null);

  const toggleGpsLogging = (enabled: boolean) => {
    hapticFeedback.light();
    setGpsLogging(enabled);
    setGpsLoggingEnabled(enabled);
    setLogCount(getGpsLogCount());
  };

  const copyGpsLogs = async () => {
    try {
      hapticFeedback.light();
      const text = getFormattedGpsLogs();
      const count = getGpsLogCount();
      await Clipboard.setStringAsync(text);
      hapticFeedback.success();
      Alert.alert(
        'GPS Debug Log Copied',
        `Copied ${count} diagnostic ${count === 1 ? 'entry' : 'entries'} to clipboard.\n\nClipboard contains in-memory telemetry decisions only.`
      );
    } catch {
      Alert.alert('Error', 'Could not copy GPS debug log.');
    }
  };

  const clearGpsLogs = () => {
    hapticFeedback.light();
    clearGpsDiagnosticLogs();
    setLogCount(0);
    Alert.alert('Log Cleared', 'In-memory GPS debug buffer has been cleared.');
  };

  const copyDiagnostics = async () => {
    try {
      hapticFeedback.light();
      const sizeBytes = await getDatabaseSize();
      const kb = (sizeBytes / 1024).toFixed(1);
      const text = [
        `App: Rideoxy`,
        `Version: ${APP_VERSION}`,
        `Build: ${BUILD_NUMBER}`,
        `OS: ${Platform.OS} ${Platform.Version}`,
        `Database Size: ${kb} KB (${sizeBytes} bytes)`,
        `Storage Mode: Local On-Device SQLite`,
        `Export Date: ${new Date().toISOString()}`,
      ].join('\n');

      await Clipboard.setStringAsync(text);
      hapticFeedback.success();
      Alert.alert(
        'Diagnostics Copied',
        `System diagnostics copied to clipboard:\n\n${text}\n\nNo data is transmitted over the network.`
      );
    } catch {
      Alert.alert('Error', 'Could not copy diagnostics.');
    }
  };

  const goTo = (path: string) => {
    close();
    // Allow the sheet to dismiss before navigating.
    setTimeout(() => router.push(path as never), 120);
  };

  const confirmDelete = (title: string, message: string, action: () => Promise<void>, doneMessage: string) => {
    close();
    setTimeout(
      () =>
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await action();
                Alert.alert('Data Cleared', doneMessage);
              } catch (err) {
                Alert.alert('Error', 'Could not clear the data. Please try again.');
              }
            },
          },
        ]),
      150
    );
  };

  const comingSoon = (title: string, body: string) => (
    <View style={styles.soonWrap}>
      <View style={styles.soonIcon}>
        <Clock size={22} color={UI.accent} strokeWidth={1.8} />
      </View>
      <Text style={styles.soonTitle}>Coming soon</Text>
      <Text style={styles.soonBody}>{body}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: tabBarHeight,
          paddingHorizontal: UI.screenPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FadeInUpView index={0}>
          <ScreenHeader title="Settings" subtitle="Personalize your ride experience." />
        </FadeInUpView>

        <FadeInUpView index={1}>
          <Card padded={false}>
            <ListRow
              variant="plain"
              divider
              leading={<IconBubble><User {...iconProps} /></IconBubble>}
              title="Profile"
              subtitle="Manage your account"
              onPress={() => setSheet('profile')}
            />
            <ListRow
              variant="plain"
              divider
              leading={<IconBubble><SlidersHorizontal {...iconProps} /></IconBubble>}
              title="App Preferences"
              subtitle="Theme, units, notifications"
              onPress={() => setSheet('prefs')}
            />
            <ListRow
              variant="plain"
              divider
              leading={<IconBubble><MapPin {...iconProps} /></IconBubble>}
              title="Location & Tracking"
              subtitle="GPS, background services"
              onPress={() => setSheet('location')}
            />
            <ListRow
              variant="plain"
              divider
              leading={<IconBubble><Database {...iconProps} /></IconBubble>}
              title="Data & Storage"
              subtitle="Backup, export, clear data"
              onPress={() => setSheet('data')}
            />
            <ListRow
              variant="plain"
              leading={<IconBubble><CircleHelp {...iconProps} /></IconBubble>}
              title="Help & Support"
              subtitle="FAQs, contact us"
              onPress={() => setSheet('help')}
            />
          </Card>
        </FadeInUpView>

        <FadeInUpView index={2}>
          <Text style={styles.sectionHeader}>Experimental</Text>
          <Card padded={true}>
            <View style={styles.experimentalToggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>Experimental features</Text>
                <Text style={styles.toggleSubtitle}>
                  Features here are unfinished and may change or disappear.
                </Text>
              </View>
              <Switch
                value={experimentalEnabled}
                onValueChange={toggleExperimental}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: UI.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </FadeInUpView>

        <FadeInUpView index={3}>
          <Card padded={false} style={styles.aboutCard}>
            <ListRow
              variant="plain"
              divider
              leading={<IconBubble><Info {...iconProps} /></IconBubble>}
              title="About RIDEOXY"
              subtitle={`Version ${APP_VERSION} (Build ${BUILD_NUMBER})`}
              onPress={() => setSheet('about')}
            />
            <ListRow
              variant="plain"
              leading={<IconBubble><FileCode {...iconProps} /></IconBubble>}
              title="Diagnostics"
              subtitle="GPS debug log & system diagnostics"
              onPress={() => {
                setLogCount(getGpsLogCount());
                setSheet('diagnostics');
              }}
            />
          </Card>
        </FadeInUpView>
      </ScrollView>

      {/* Profile (no accounts in an offline app) */}
      <InfoSheet visible={sheet === 'profile'} title="Profile" subtitle="Manage your account" onClose={close}>
        {comingSoon(
          'Profile',
          'Rideoxy is fully offline and has no accounts. A rider profile will arrive in a future update.'
        )}
      </InfoSheet>

      {/* Backup placeholder */}
      <InfoSheet visible={sheet === 'backup'} title="Backup" subtitle="Protect your ride history" onClose={close}>
        {comingSoon('Backup', 'Local backup and restore is not available yet. Your data stays safely on this device.')}
      </InfoSheet>

      {/* App Preferences: units + currency */}
      <InfoSheet
        visible={sheet === 'prefs'}
        title="App Preferences"
        subtitle="Units and currency apply across the whole app."
        onClose={close}
      >
        {sheet === 'prefs' ? <PreferencesPanel /> : null}
      </InfoSheet>

      {/* Location & Tracking */}
      <InfoSheet visible={sheet === 'location'} title="Location & Tracking" subtitle="GPS, background services" onClose={close}>
        <Text style={styles.paragraph}>
          Rideoxy uses precise device GPS while a ride is being recorded. Background location is active only during a
          recording session, so your telemetry continues when the screen is off or the phone is mounted.
        </Text>
        <SheetAction
          icon={<Settings2 size={16} color={UI.textPrimary} />}
          label="Open system settings"
          description="Review location permission for Rideoxy"
          onPress={() => {
            close();
            Linking.openSettings().catch(() => {});
          }}
        />
      </InfoSheet>

      {/* Data & Storage */}
      <InfoSheet visible={sheet === 'data'} title="Data & Storage" subtitle="Backup, export, clear data" onClose={close}>
        <SheetAction
          icon={<Download size={16} color={UI.textPrimary} />}
          label="Export GPX"
          description="Open any ride in My Rides and tap its GPX export button"
          onPress={() => goTo('/(tabs)/history')}
        />
        <SheetAction
          icon={<CloudUpload size={16} color={UI.textPrimary} />}
          label="Backup"
          description="Coming soon"
          onPress={() => setSheet('backup')}
        />
        <SheetLabel>CLEAR DATA</SheetLabel>
        <SheetAction
          icon={<Trash2 size={16} color={Colors.danger} />}
          label="Delete All Rides"
          description="Permanently clear all ride records and routes"
          destructive
          onPress={() =>
            confirmDelete(
              'Delete All Rides',
              'Are you sure you want to permanently delete all recorded motorcycle rides from this device? This action cannot be undone.',
              deleteAllRides,
              'All local rides have been deleted.'
            )
          }
        />
        <SheetAction
          icon={<Fuel size={16} color={Colors.danger} />}
          label="Delete All Fuel Logs"
          description="Permanently clear every fuel entry"
          destructive
          onPress={() =>
            confirmDelete(
              'Delete All Fuel Logs',
              'Are you sure you want to permanently delete all fuel logs from this device? This action cannot be undone.',
              deleteAllFuelLogs,
              'All local fuel logs have been deleted.'
            )
          }
        />
        <SheetAction
          icon={<Trash2 size={16} color={Colors.danger} />}
          label="Delete All Data"
          description="Permanently erase all rides and fuel logs"
          destructive
          onPress={() =>
            confirmDelete(
              'Delete All Data',
              'Are you sure you want to permanently erase ALL motorcycle rides and fuel logs from this device? This action cannot be undone.',
              async () => {
                await deleteAllRides();
                await deleteAllFuelLogs();
              },
              'All rides and fuel logs have been permanently erased.'
            )
          }
        />
      </InfoSheet>

      {/* Help & Support */}
      <InfoSheet visible={sheet === 'help'} title="Help & Support" subtitle="FAQs, contact us" onClose={close}>
        <SheetLabel>FAQS</SheetLabel>
        {FAQS.map((f) => (
          <View key={f.q} style={styles.faq}>
            <Text style={styles.faqQ}>{f.q}</Text>
            <Text style={styles.faqA}>{f.a}</Text>
          </View>
        ))}
        <SheetLabel>CONTACT US</SheetLabel>
        <SheetAction
          icon={<InstagramIcon size={16} color="#E1306C" />}
          label="Developer Profile"
          description="instagram.com/nam7sh"
          onPress={() => Linking.openURL('https://instagram.com/nam7sh').catch(() => {})}
        />
      </InfoSheet>

      {/* About */}
      <InfoSheet visible={sheet === 'about'} title="About RIDEOXY" subtitle={`Version ${APP_VERSION} · More Rides. Better Days.`} onClose={close}>
        <Text style={styles.paragraph}>
          Privacy-first, local-only motorcycle ride tracking and fuel intelligence.
        </Text>
        <SheetAction
          icon={<Shield size={16} color={UI.textPrimary} />}
          label="Privacy Policy"
          description="Local storage & offline telemetry disclosure"
          onPress={() => goTo('/privacy')}
        />
        <SheetAction
          icon={<FileText size={16} color={UI.textPrimary} />}
          label="Third-Party Licenses"
          description="Open source libraries and notices"
          onPress={() => goTo('/licenses')}
        />
        <SheetLabel>SYSTEM DIAGNOSTICS</SheetLabel>
        <SheetAction
          icon={<Copy size={16} color={UI.textPrimary} />}
          label="Copy Diagnostics to Clipboard"
          description={`Rideoxy v${APP_VERSION} (${BUILD_NUMBER}) · ${Platform.OS} ${Platform.Version}`}
          onPress={copyDiagnostics}
        />
        <SheetLabel>GEOSPATIAL & VECTOR TILES</SheetLabel>
        <Text style={styles.paragraph}>{MAP_ATTRIBUTION.attributionNotice}</Text>
      </InfoSheet>

      {/* Diagnostics: System & GPS Debug Log */}
      <InfoSheet
        visible={sheet === 'diagnostics'}
        title="Diagnostics"
        subtitle="GPS telemetry debug log & system diagnostics"
        onClose={close}
      >
        <SheetLabel>GPS DEBUG LOG</SheetLabel>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>GPS debug log</Text>
            <Text style={styles.toggleSubtitle}>
              In-memory ring buffer (last ~300 fixes) recording accuracy, reported speed, distance, and filter decisions.
            </Text>
          </View>
          <Switch
            value={gpsLogging}
            onValueChange={toggleGpsLogging}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: Colors.primary }}
            thumbColor={gpsLogging ? '#FFFFFF' : '#9CA3AF'}
            ios_backgroundColor="rgba(255,255,255,0.12)"
          />
        </View>

        <Text style={styles.logStatusText}>
          Buffer: {logCount} / 300 fixes in memory ({gpsLogging ? 'Active' : 'Off'})
        </Text>

        <SheetAction
          icon={<Copy size={16} color={UI.textPrimary} />}
          label="Copy log"
          description={
            logCount > 0
              ? `Copy ${logCount} buffered GPS fixes to clipboard`
              : 'Copy formatted in-memory GPS telemetry log'
          }
          onPress={copyGpsLogs}
        />

        {logCount > 0 ? (
          <SheetAction
            icon={<Trash2 size={16} color={Colors.danger} />}
            label="Clear debug buffer"
            description="Clear in-memory telemetry points"
            destructive
            onPress={clearGpsLogs}
          />
        ) : null}

        <Text style={styles.paragraph}>
          Nothing is stored in the database or sent anywhere. When OFF, zero buffer overhead.
        </Text>

        <SheetLabel>SYSTEM TELEMETRY</SheetLabel>
        <SheetAction
          icon={<Copy size={16} color={UI.textPrimary} />}
          label="Copy System Diagnostics"
          description={`Rideoxy v${APP_VERSION} (${BUILD_NUMBER}) · ${Platform.OS} ${String(Platform.Version)}`}
          onPress={copyDiagnostics}
        />
      </InfoSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.hairline,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    color: UI.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubtitle: {
    color: UI.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  logStatusText: {
    color: UI.accent,
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 8,
  },
  sectionHeader: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  experimentalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  aboutCard: {
    marginTop: 18,
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paragraph: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 6,
  },
  soonWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  soonIcon: {
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
  soonTitle: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  soonBody: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  faq: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.hairline,
  },
  faqQ: {
    color: UI.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  faqA: {
    color: UI.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
});
