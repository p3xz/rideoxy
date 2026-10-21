import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  Map,
  Camera,
  CameraRef,
  GeoJSONSource,
  Layer,
  Marker,
} from '@maplibre/maplibre-react-native';
import { DEFAULT_MAP_STYLE, MAP_DEFAULTS } from '../constants/map';
import { Colors } from '../constants/theme';
import { StartMarker, EndMarker, LiveRiderMarker } from './svg/Markers';

interface RideMapProps {
  coordinates?: [number, number][]; // Array of [longitude, latitude]
  currentLocation?: {
    latitude: number;
    longitude: number;
    heading?: number | null;
  } | null;
  interactive?: boolean;
  followUser?: boolean;
  styleUrl?: string;
  zoomLevel?: number;
  showStartEndMarkers?: boolean;
  height?: number | string;
  onLongPress?: (coordinate: [number, number]) => void;
  pinnedCoordinate?: [number, number] | null;
}

export const RideMap: React.FC<RideMapProps> = ({
  coordinates = [],
  currentLocation,
  interactive = true,
  followUser = false,
  styleUrl = DEFAULT_MAP_STYLE,
  zoomLevel = 15,
  showStartEndMarkers = true,
  height = '100%',
  onLongPress,
  pinnedCoordinate,
}) => {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // GeoJSON LineString for recorded route
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates.length >= 2 ? coordinates : [],
        },
      },
    ],
  };

  const centerCoordinate: [number, number] = pinnedCoordinate
    ? pinnedCoordinate
    : currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : coordinates.length > 0
    ? coordinates[coordinates.length - 1]
    : MAP_DEFAULTS.defaultCenter;

  const startCoordinate = coordinates.length > 0 ? coordinates[0] : null;
  const endCoordinate = coordinates.length > 1 ? coordinates[coordinates.length - 1] : null;

  const lastCameraCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (cameraRef.current && mapReady) {
      if (followUser && currentLocation) {
        const curCenter: [number, number] = [currentLocation.longitude, currentLocation.latitude];
        const prev = lastCameraCenter.current;
        // Only ease camera when position has physically shifted (> ~2m) or on initial render
        if (!prev || Math.abs(prev[0] - curCenter[0]) > 0.00002 || Math.abs(prev[1] - curCenter[1]) > 0.00002) {
          lastCameraCenter.current = curCenter;
          cameraRef.current.easeTo({
            center: curCenter,
            zoom: zoomLevel,
            duration: 1000,
          });
        }
      } else if (coordinates.length >= 2 && !interactive) {
        const longitudes = coordinates.map((c) => c[0]);
        const latitudes = coordinates.map((c) => c[1]);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);

        cameraRef.current.fitBounds(
          [minLng, minLat, maxLng, maxLat],
          {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            duration: 1000,
          }
        );
      }
    }
  }, [currentLocation, coordinates.length, mapReady, followUser, zoomLevel, interactive]);

  return (
    <View style={[styles.container, { height: height as any }]}>
      <Map
        style={styles.map}
        mapStyle={styleUrl}
        logo={false}
        attribution={false}
        compass={interactive}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
        onLongPress={(event) => {
          const lngLat = event.nativeEvent?.lngLat ?? (event as any).lngLat;
          if (lngLat && Array.isArray(lngLat) && typeof lngLat[0] === 'number') {
            onLongPress?.([lngLat[0], lngLat[1]]);
          }
        }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onDidFailLoadingMap={() => {
          setMapError('Offline · Map tiles unavailable');
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: centerCoordinate,
            zoom: zoomLevel,
          }}
        />

        {/* Route Line with Outline for maximum contrast */}
        {coordinates.length >= 2 && (
          <GeoJSONSource id="routeSource" data={routeGeoJSON}>
            <Layer
              id="routeLineOutline"
              type="line"
              paint={{
                'line-color': Colors.routeLineOutline,
                'line-width': MAP_DEFAULTS.routeLineOutlineWidth,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
            <Layer
              id="routeLine"
              type="line"
              paint={{
                'line-color': Colors.routeLine,
                'line-width': MAP_DEFAULTS.routeLineWidth,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        )}

        {/* Start Point Marker */}
        {showStartEndMarkers && startCoordinate && (
          <Marker id="startPoint" lngLat={startCoordinate}>
            <View>
              <StartMarker size={24} />
            </View>
          </Marker>
        )}

        {/* End Point Marker for completed rides */}
        {showStartEndMarkers && !followUser && endCoordinate && (
          <Marker id="endPoint" lngLat={endCoordinate}>
            <View>
              <EndMarker size={24} />
            </View>
          </Marker>
        )}

        {/* Pinned Destination Marker */}
        {pinnedCoordinate && (
          <Marker id="pinnedPoint" lngLat={pinnedCoordinate}>
            <View>
              <EndMarker size={28} />
            </View>
          </Marker>
        )}

        {/* Live Rider Marker for active rides */}
        {followUser && currentLocation && (
          <Marker
            id="liveRider"
            lngLat={[currentLocation.longitude, currentLocation.latitude]}
          >
            <View>
              <LiveRiderMarker size={32} heading={currentLocation.heading} />
            </View>
          </Marker>
        )}
      </Map>

      {/* Offline notice */}
      {mapError && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeText}>Map Offline · GPS Recording Active</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  offlineNotice: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 32, 44, 0.90)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  offlineNoticeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});
