export type RideStatus = 'idle' | 'starting' | 'running' | 'paused' | 'finishing' | 'completed' | 'interrupted';

export type RideMode = 'free' | 'destination';
export type EstimateSource = 'osrm' | 'manual';

export interface Ride {
  id: string;
  start_time: number; // Unix timestamp in ms
  end_time: number | null; // Unix timestamp in ms
  duration: number; // Total elapsed time in seconds
  moving_time: number; // Active moving time in seconds
  distance: number; // Distance in kilometers
  average_speed: number; // Average speed in km/h (distance / moving_time)
  max_speed: number; // Maximum speed in km/h
  status: RideStatus;
  created_at: number; // Unix timestamp in ms

  // ETA & Destination Ride Mode Fields
  ride_mode?: RideMode;
  destination_name?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  estimated_duration_sec?: number | null;
  estimated_distance_m?: number | null;
  estimate_source?: EstimateSource | null;
}

export interface TrackPoint {
  id?: number;
  ride_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // Speed in m/s from GPS or calculated
  accuracy: number | null; // Accuracy in meters
  heading: number | null; // Heading in degrees (0-360)
  timestamp: number; // Unix timestamp in ms
}

export interface RawGPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: number;
  mocked?: boolean;
}
