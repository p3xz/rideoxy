# RIDEOXY — iOS Capabilities Roadmap

This document outlines future iOS-native capabilities evaluated for RIDEOXY, technical prerequisites, architectural targets, config plugin requirements, and Apple Developer account constraints.

---

## 1. Current Architecture Baseline

Rideoxy currently targets **iOS 15.1+** with:
- **Free Apple ID Sideloading Compatibility**: AltStore, SideStore, and Sideloadly compatible using standard 7-day personal provisioning profiles.
- **Entitlement-Free Architecture**: No iCloud, Push Notifications, App Groups, HealthKit, or Associated Domains. Only standard `Info.plist` keys (`UIBackgroundModes: ["location"]`, camera/photo descriptions) are used.
- **Offline & On-Device**: SQLite persistence, no remote sync, no accounts, zero telemetry servers.
- **CI Automation**: GitHub Actions compiles unsigned `.app` for Simulator (`xcodebuild -sdk iphonesimulator`) and packages `Rideoxy-unsigned.ipa` (`xcodebuild archive -sdk iphoneos`) with `CODE_SIGNING_ALLOWED=NO`.

---

## 2. Advanced iOS Capabilities Roadmap

### A. Live Activities & Dynamic Island (ActivityKit)
- **Feature Scope**:
  - **Lock Screen HUD**: Live speed readout, ride elapsed time, route distance, and GPS signal strength.
  - **Dynamic Island**:
    - *Compact Leading*: Mini emerald pulse / speedometer icon.
    - *Compact Trailing*: Current speed (e.g. `62 km/h`) or distance (`14.2 km`).
    - *Expanded*: Full telemetry cockpit with Pause / Resume / End controls.
- **Technical Requirements**:
  - iOS Deployment Target: Must raise deployment target from `15.1` to `16.1+`.
  - Target Architecture: Requires an independent **Widget Extension** (`RideoxyWidgetExtension`) containing Swift/SwiftUI code conforming to `ActivityAttributes` and `WidgetBundle`.
  - Integration: Needs a custom Expo Config Plugin to:
    1. Create the Widget Extension target in the Xcode project (`.xcodeproj`).
    2. Embed the extension in the main `.app`.
    3. Link `ActivityKit.framework` and `SwiftUI.framework`.
    4. Set `NSSupportsLiveActivities: YES` in main `Info.plist`.
  - Account Constraint: **Free Apple ID compatible** for local sideloading on physical devices running iOS 16.1+, but cannot be distributed on TestFlight or App Store without a paid Apple Developer Account (\$99/year).
  - CI Preservation: `xcodebuild` commands in `.github/workflows/ios.yml` must build with `CODE_SIGNING_ALLOWED=NO` across both main and extension schemes.

---

### B. Lock Screen & Home Screen Widgets (WidgetKit)
- **Feature Scope**:
  - Circular & Rectangular Lock Screen widgets: Quick "Start Ride" launcher, current odometer, or days since last ride.
  - Home Screen widgets: Monthly distance odometer, latest fuel economy (`km/L` or `mpg`), and recent ride thumbnail.
- **Technical Requirements**:
  - Target Architecture: SwiftUI `TimelineProvider` inside the Widget Extension.
  - Data Sharing: Requires data sharing between the main React Native app and the extension target.
  - Data Transport: Because SQLite cannot be shared without an App Group container:
    - **App Groups Entitlement (`group.com.rideoxy.app`)** is required.
    - An Expo config plugin or native module must read/write to `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`.
- **Account Constraint: PAID DEVELOPER ACCOUNT MANDATORY**:
  - Free Personal Apple IDs **cannot** provision App Groups entitlements without custom provisioning profiles from a paid developer team. Adding App Groups will break AltStore / SideStore sideloading unless App Groups is omitted or simulated in memory.

---

### C. Siri Shortcuts & App Intents
- **Feature Scope**:
  - Voice triggers: "Hey Siri, Start Motorcycle Ride in Rideoxy", "Hey Siri, Log Fuel".
  - Spotlight Search: Index completed rides and motorcycles in iOS Spotlight search.
- **Technical Requirements**:
  - Framework: `AppIntents` framework (iOS 16+) or legacy `SiriKit` (`INIntent`).
  - Expo Plugin: Config plugin injecting Swift Intent classes conforming to `AppIntent` into the main target.
- **Account Constraint**: **Free Apple ID compatible** (App Intents are embedded in the main app bundle without requiring provisioning entitlements).

---

### D. Apple Watch Companion App (watchOS)
- **Feature Scope**:
  - Wrist-mounted cockpit display for speedometer, heart rate integration, distance, and quick pause/resume haptic buttons.
- **Technical Requirements**:
  - Multi-target Project: Requires adding a `watchOS App` and `watchOS Extension` target to the Xcode workspace.
  - Inter-device Sync: `WatchConnectivity` framework (`WCSession`) for real-time messaging between iPhone and Apple Watch.
  - HealthKit: Heart rate telemetry requires `HealthKit.framework` and `com.apple.developer.healthkit` entitlement.
- **Account Constraint: PAID DEVELOPER ACCOUNT MANDATORY**:
  - Free personal developer certificates do not support provisioning paired watchOS bundles alongside iOS bundles, and HealthKit entitlements require a paid account.

---

### E. Notifications & Reminders (Maintenance Intelligence)
- **Architecture Principle**:
  - Rideoxy does not require remote Push Notifications (APNs). Remote APNs requires push certificates and an active push backend, conflicting with Rideoxy's 100% offline ethos.
- **Offline Alternative**:
  - **Local Scheduled Notifications** via `expo-notifications` (e.g. "Chain lube due in 100 km", "Oil change reminder").
  - Local notifications do not require any Apple entitlements and are **100% compatible with Free Apple IDs**.

---

### F. Cloud Backup & Sync
- **Architecture Principle**:
  - RIDEOXY is designed as an offline-first, local-storage platform with manual GPX export.
- **If Cloud Sync is Implemented in Future**:
  - **iCloud Drive / CloudKit**: Requires `com.apple.developer.icloud-container-identifiers` entitlement. **Requires Paid Developer Account**.
  - **Local Filesystem Alternative (Recommended)**: Use `expo-sharing` and iOS Document Picker (`UIDocumentPickerViewController`) to export/import complete SQLite database backup files (`rideoxy-backup.db`) directly into user-chosen storage (iCloud Drive folder, Google Drive, or local storage) without requiring iCloud developer entitlements.

---

## 3. Checklist for Future Target Upgrades

When implementing any of the above targets:
1. Ensure the Expo Config Plugin handles dynamic target injection during `npx expo prebuild --platform ios --clean`.
2. Update `.github/workflows/ios.yml` to specify both schemes or build the umbrella `.xcworkspace` with `CODE_SIGNING_ALLOWED=NO`.
3. Never modify the permanent bundle identifier: `com.rideoxy.app`.
4. Keep the Free-Apple-ID sideload build (`Job B: ios-unsigned-ipa`) functional by ensuring non-standard entitlements remain opt-in or isolated to paid profiles (`Job C: ios-eas-build`).
