/**
 * Map configuration for Rideoxy
 * MapLibre is the rendering engine inside React Native.
 * OpenFreeMap supplies vector tiles and map styles.
 */

export const MAP_STYLES = {
  // Default dark-compatible technical style
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  // Alternative high-contrast / bright style
  bright: 'https://tiles.openfreemap.org/styles/bright',
  // Positron light-minimal fallback
  positron: 'https://tiles.openfreemap.org/styles/positron',
} as const;

export const DEFAULT_MAP_STYLE = MAP_STYLES.liberty;

export const MAP_ATTRIBUTION = {
  mapLibre: 'MapLibre (Open-source map rendering engine)',
  openFreeMap: 'OpenFreeMap (Free vector map style and vector tile service)',
  openStreetMap: '© OpenStreetMap contributors',
  attributionNotice: 'Map rendering by MapLibre. Map tiles and styles provided by OpenFreeMap. Map data © OpenStreetMap contributors.',
};

export const MAP_DEFAULTS = {
  defaultZoom: 15,
  overviewZoom: 12,
  minZoomLevel: 2,
  maxZoomLevel: 20,
  defaultCenter: [0, 20] as [number, number], // [longitude, latitude]
  routeLineWidth: 5,
  routeLineOutlineWidth: 7,
};
