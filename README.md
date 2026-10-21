# Rideoxy 🏍️

> **Privacy-first, local-only motorcycle ride tracking and fuel intelligence application.**

Rideoxy is a high-performance mobile application engineered for motorcyclists. Track your rides, monitor live speeds, analyze fuel efficiency, manage your machine profile, and export GPX routes — with complete on-device privacy, zero telemetry trackers, and no cloud accounts.

---

## 🌟 Implemented Features

- **📍 Precision Ride Tracking**: Authoritative background GPS logging with multi-stage noise filtering, stationary jitter rejection (stationary anchor tracking), sub-second burst deduplication, and accurate Haversine distance calculations.
- **🗺️ Route & Map Visualization**: Vector map rendering powered by MapLibre Native with OpenFreeMap styles, full route polyline rendering, and graceful offline fallback states.
- **⛽ Fuel & Mileage Intelligence**: Detailed fill-up logging with full-tank chain calculations (km/L, MPG US/UK, L/100km), cost-per-kilometer/mile, multi-currency formatting (INR, USD, EUR, GBP, AUD, CAD, JPY), and spending trends.
- **🏍️ Machine Profile & Garage**: Motorcycle profile management with persistent on-device telemetry and lifetime statistics.
- **📊 Ride Analytics & Records**: Comprehensive lifetime telemetry, monthly ride summaries, personal records (longest ride, highest average speed, top speed), and complete session history.
- **📁 GPX Route Export**: Export any recorded motorcycle trip to standard `.gpx` files through the operating system share sheet for use in Garmin, Strava, or Google Earth.
- **🛡️ Interrupted Ride Recovery**: Automatic crash and interruption recovery on app launch, allowing riders to resume or safely save in-progress sessions.
- **🎯 Destination Mode & Route Pace**: Optional destination mode with upfront ETA routing via Ola Maps (primary) or OpenStreetMap Nominatim/OSRM (fallback), manual expected minutes fallback, and post-ride Route Pace delta comparisons.
- **🔒 100% Local & Private**: Free rides send zero network requests. All ride data, trackpoints, and fuel records are stored strictly in your device's local SQLite database (`rideoxy.db` with seamless backward-compatible migration from the app's earlier database file).

### Planned Features (Intentionally Out of Scope for V1)
- Lean-angle gyroscope analysis
- Maintenance reminders and service scheduling

---

## 🛠️ Tech Stack

- **Framework**: Expo (SDK 54) & React Native (0.81.5)
- **Navigation**: Expo Router (v6) file-based routing
- **Map Engine**: `@maplibre/maplibre-react-native`
- **Database**: Expo SQLite (Local WAL-mode SQLite database)
- **Background Location**: Expo Location & Expo TaskManager
- **File System & Sharing**: Expo FileSystem & Expo Sharing
- **Styling & UI**: Custom high-contrast cockpit dark theme, Lucide Icons, React Native Safe Area Context
- **Testing**: Jest, Jest-Expo, ts-jest

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn
- Expo CLI (`npx expo`)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run automated test suite:
   ```bash
   npm test
   ```

3. Run TypeScript type checks:
   ```bash
   npx tsc --noEmit
   ```

4. Start development server:
   ```bash
   npm start
   ```

> [!IMPORTANT]
> **Expo Go Notice**: Rideoxy uses native modules for background location tasks and `@maplibre/maplibre-react-native` vector mapping. Because of these native dependencies, **the app cannot run inside Expo Go**. It must be run using a development build (`npx expo run:ios` or `npx expo run:android`) or a standalone build.

---

## ⚙️ Configuration & API Keys

### Ola Maps API Key (Optional)

Rideoxy uses [Ola Maps Directions](https://maps.olacabs.com/) (free tier up to 100K requests/month) for high-accuracy motorcycle routing when planning a Destination ride. No paid Ola products (Places autocomplete, geocoding, roads) are ever called. Destination search uses OpenStreetMap Nominatim or interactive map pin drop. If no Ola API key is provided, the app automatically falls back to OpenStreetMap OSRM or manual rider estimates.

1. **Local Development**:
   - Copy `.env.example` to `.env` in the project root:
     ```bash
     cp .env.example .env
     ```
   - Set your API key:
     ```env
     EXPO_PUBLIC_OLA_MAPS_API_KEY=your_actual_key_here
     ```

2. **GitHub Actions CI / Sideload Builds**:
   - Add a repository secret named `OLA_MAPS_API_KEY` under **Settings** > **Secrets and variables** > **Actions**.
   - The iOS workflow automatically maps this secret to `EXPO_PUBLIC_OLA_MAPS_API_KEY` during build time.

> [!WARNING]
> **Client-Side Key Visibility Notice**: Environment variables prefixed with `EXPO_PUBLIC_*` are bundled into client-side JavaScript and are extractable from application binaries.
> - Restrict your key within the [Ola Maps Developer Console](https://maps.olacabs.com/) (by API scope, IP, or rate limits).
> - Do not attach a billing card with automatic reload, or operate on the free usage tier with a zero balance limit.
> - Free ride mode never accesses or transmits the key or any network requests.

---

## 📱 iOS Build & Free Sideloading

Rideoxy can be built for iOS completely free using GitHub Actions and sideloaded onto your personal iPhone without requiring a paid Apple Developer Program membership.

### 1. Downloading the Build Artifacts
Every push to `main` builds a simulator `.app` in GitHub Actions. Release tags (`v*`) and manual workflow triggers (`workflow_dispatch`) produce an unsigned `.ipa` package (`Rideoxy-unsigned.ipa`):
1. Navigate to the **Actions** tab in this GitHub repository.
2. Select the latest run of **iOS CI & Unsigned Sideload Build**.
3. Scroll down to the **Artifacts** section and download `Rideoxy-unsigned-ipa`.
4. Unzip the downloaded file to retrieve `Rideoxy-unsigned.ipa`.

### 2. Free Sideloading onto iPhone (Sideloadly / AltStore / SideStore)
You can install `Rideoxy-unsigned.ipa` on your physical device using any free sideloading utility and a standard personal Apple ID:
- **Using Sideloadly** (macOS / Windows):
  1. Download and install [Sideloadly](https://sideloadly.io/).
  2. Connect your iPhone via USB.
  3. Drag and drop `Rideoxy-unsigned.ipa` into Sideloadly.
  4. Enter your personal Apple ID credentials to sign the app locally with your free developer certificate.
  5. Click **Start** to install.
- **Using AltStore or SideStore**:
  1. Open AltStore or SideStore on your device.
  2. Tap the `+` icon in the My Apps tab and select `Rideoxy-unsigned.ipa`.

### 3. Enabling Developer Mode (iOS 16+)
On iOS 16 and later, sideloaded apps require Developer Mode to run:
1. On your iPhone, open **Settings** > **Privacy & Security**.
2. Scroll to the bottom and select **Developer Mode**.
3. Toggle Developer Mode **ON** and reboot your device when prompted.
4. After rebooting, tap **Turn On** and enter your device passcode.
5. In **Settings** > **General** > **VPN & Device Management**, tap your Apple ID and select **Trust**.

### 4. Free Apple ID Limits & Preservation Rules
- **7-Day Expiration**: Apps sideloaded with a free Apple ID expire after 7 days unless refreshed over Wi-Fi (AltStore/SideStore) or re-sideloaded (Sideloadly).
- **App Quota**: Free Apple IDs allow up to 3 active sideloaded apps per device.
- **Keep Your Ride Data Safe**:
  - Always reinstall or refresh over the same bundle identifier (`com.rideoxy.app`). This preserves your local SQLite database (`rideoxy.db`) across updates.
  - As a best practice, always export your important rides to GPX from the app before performing a reinstall.
- **Background GPS Verification**: Background GPS logging must be verified on a real physical iPhone, as simulator environments cannot replicate real device power management and satellite reception.

### 5. Official App Store / TestFlight (Paid Developer Account)
An Apple Developer Program membership ($99/year) is only needed if you want to distribute via TestFlight or the Apple App Store. Job C (`ios-eas-build`) in GitHub Actions can be triggered manually if an `EXPO_TOKEN` secret is configured in your repository settings.

---

## 📄 License & Attribution

Rideoxy is open-source software. Vector map tiles and styles provided by OpenFreeMap. Map data © OpenStreetMap contributors.
