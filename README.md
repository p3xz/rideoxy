# Rideoxy 🏍️

> **Privacy-first, offline-ready motorcycle ride tracking and fuel telemetry app.**

Rideoxy is a mobile application built for motorcyclists. Track your rides, monitor speeds and lean angles, analyze fuel efficiency, record maintenance logs, and export your GPX routes — all with complete privacy and zero mandatory cloud accounts.

---

## 🌟 Features

- **📍 Precision Ride Tracking**: Background GPS logging with noise filtering, accurate distance calculation (Haversine algorithm), and speed analysis.
- **🗺️ Offline-Ready Maps**: Vector map rendering powered by MapLibre GL Native.
- **⛽ Fuel & Maintenance Log**: Track fill-ups, calculate mileage (km/L & MPG), cost per km, and service intervals.
- **📊 Comprehensive Statistics**: Lifetime distance, top speeds, average speeds, monthly breakdowns, and ride history.
- **📁 GPX Route Export**: Export any recorded ride to standard `.gpx` files to share or import into Google Earth, Strava, or Garmin.
- **🔒 100% Local & Private**: All ride data, track points, and garage records are stored locally using SQLite on your device.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev/) (SDK 54) & [React Native](https://reactnative.dev/) (0.81)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **Maps**: [@maplibre/maplibre-react-native](https://github.com/maplibre/maplibre-react-native)
- **Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Background GPS**: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/) & [Expo TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/)
- **Animations & UI**: React Native Reanimated, Lucide Icons, Safe Area Context

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (`npx expo`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/p3xz/rideoxy.git
   cd rideoxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

---

## 📱 Building for iOS (100% Free / No Paid Apple Developer Account)

You do not need a paid $99/year Apple Developer account to build and run Rideoxy on your iPhone from Windows.

### Method 1: Automated GitHub Actions (.ipa Build)
1. Push your changes to GitHub.
2. Go to the **Actions** tab in your GitHub repository.
3. Select the **`Build iOS IPA (Free / No Apple Dev Account)`** workflow.
4. Click **Run workflow** on the `master` branch.
5. Once the build completes, download the **`rideoxy-ios-ipa`** artifact.
6. Connect your iPhone to your Windows PC via USB and install using **[Sideloadly](https://sideloadly.io/)** with your free personal Apple ID.

### Method 2: EAS iOS Simulator Build
If testing on an iOS Simulator or macOS:
```bash
npx eas-cli build --platform ios --profile simulator
```

---

## 🤖 Building for Android

Build a standalone APK or AAB for Android using EAS:
```bash
npx eas-cli build --platform android --profile preview
```

---

## 📂 Project Structure

```
├── app/                  # Expo Router navigation and screens
│   ├── (tabs)/           # Bottom tab bar screens (Home, Garage, Stats, History, Fuel, Settings)
│   ├── active-ride.tsx   # Live HUD and GPS tracking screen
│   ├── fuel-entry.tsx    # Fuel fill-up input modal
│   └── ride-summary.tsx  # Post-ride summary and stats
├── components/           # Reusable UI components (SpeedDisplay, RideMap, Cards)
├── constants/            # Color palettes, GPS configuration, map themes
├── database/             # SQLite schema, migrations, and repositories
├── services/             # GPS filtering, distance calculations, GPX exporter, tracking engine
├── tasks/                # Background location task definitions
└── types/                # TypeScript data interfaces
```

---

## 👨‍💻 Developer

**Namish Yadav**
- GitHub: [https://github.com/p3xz](https://github.com/p3xz)
- LinkedIn: [https://www.linkedin.com/in/namish-yadav-639769408/](https://www.linkedin.com/in/namish-yadav-639769408/)
- Instagram: [https://instagram.com/nam7sh](https://instagram.com/nam7sh)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
