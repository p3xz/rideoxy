import { Coordinates, calculateDistanceMeters } from './distance';
import { Ride } from '../types/ride';
import { getEstimateSourceLabel } from './etaService';

export const ENDPOINT_TOLERANCE_METERS = 1500; // 1.5 km
export const SHORT_RIDE_ESTIMATE_THRESHOLD_SEC = 300; // 5 minutes
export const STOP_GAP_THRESHOLD_SEC = 600; // 10 minutes

export type PaceVerdict = 'faster' | 'slower' | 'on_time';

export type SuppressReason = 'endpoint_missed' | 'missing_endpoint' | 'too_short' | 'invalid_estimate';

export interface RoutePaceResult {
  hasPace: boolean;
  verdictSuppressed: boolean;
  suppressReason?: SuppressReason;
  distanceToDestinationKm?: number;
  estimatedSec: number;
  actualSec: number;
  movingSec: number;
  deltaSec: number;
  deltaMinutes: number;
  percentAhead: number | null; // null when short-ride guard applies
  verdict: PaceVerdict;
  hasStopGap: boolean;
  sourceLabel: string;
  verdictTitle: string;
  verdictDescription: string;
}

/**
 * Pure function to compute Route Pace telemetry.
 * Only valid when ride_mode = 'destination' AND estimated_duration_sec is a positive number.
 */
export function computeRoutePace(
  ride: Partial<Ride>,
  lastPoint?: Coordinates | null
): RoutePaceResult {
  const emptyResult: RoutePaceResult = {
    hasPace: false,
    verdictSuppressed: true,
    suppressReason: 'invalid_estimate',
    estimatedSec: 0,
    actualSec: 0,
    movingSec: 0,
    deltaSec: 0,
    deltaMinutes: 0,
    percentAhead: null,
    verdict: 'on_time',
    hasStopGap: false,
    sourceLabel: 'Your estimate',
    verdictTitle: '',
    verdictDescription: '',
  };

  // Only destination mode rides with a positive estimated duration have Route Pace
  if (ride.ride_mode !== 'destination') {
    return emptyResult;
  }

  const estimated = ride.estimated_duration_sec;
  if (!estimated || !Number.isFinite(estimated) || estimated <= 0) {
    return emptyResult;
  }

  const actual = Math.max(0, Math.round(ride.duration ?? 0));
  const moving = Math.max(0, Math.round(ride.moving_time ?? actual));
  const delta = estimated - actual; // Positive means faster
  const deltaMinutes = Math.round(Math.abs(delta) / 60);
  const ratio = delta / estimated;

  // Verdict band: 2% or more ahead = faster, 2% or more behind = slower, inside = right on time
  let verdict: PaceVerdict = 'on_time';
  if (ratio >= 0.02) {
    verdict = 'faster';
  } else if (ratio <= -0.02) {
    verdict = 'slower';
  }

  // Short-ride guard: If estimated duration < 5 minutes, suppress percentage
  const isShortRide = estimated < SHORT_RIDE_ESTIMATE_THRESHOLD_SEC;
  const percentAhead = isShortRide
    ? null
    : Math.round((Math.abs(delta) / estimated) * 100);

  // Stop gap flag: if total duration exceeds moving time by > 10 minutes
  const hasStopGap = (actual - moving) > STOP_GAP_THRESHOLD_SEC;

  const sourceLabel = getEstimateSourceLabel(ride.estimate_source);

  // Guard: rides ended within seconds (e.g. accidental start/stop < 15 seconds)
  if (actual < 15) {
    return {
      hasPace: true,
      verdictSuppressed: true,
      suppressReason: 'too_short',
      estimatedSec: estimated,
      actualSec: actual,
      movingSec: moving,
      deltaSec: delta,
      deltaMinutes,
      percentAhead: null,
      verdict: 'on_time',
      hasStopGap: false,
      sourceLabel,
      verdictTitle: 'RIDE ENDED QUICKLY',
      verdictDescription: 'Ride duration was too short to evaluate pace.',
    };
  }

  // Endpoint guard: check distance between last recorded GPS point and target destination
  if (ride.destination_lat != null && ride.destination_lng != null) {
    if (!lastPoint) {
      return {
        hasPace: true,
        verdictSuppressed: true,
        suppressReason: 'missing_endpoint',
        estimatedSec: estimated,
        actualSec: actual,
        movingSec: moving,
        deltaSec: delta,
        deltaMinutes,
        percentAhead: null,
        verdict: 'on_time',
        hasStopGap,
        sourceLabel,
        verdictTitle: 'DESTINATION NOT VERIFIED',
        verdictDescription: 'No GPS endpoint recorded to verify arrival.',
      };
    }

    const distMeters = calculateDistanceMeters(lastPoint, {
      latitude: ride.destination_lat,
      longitude: ride.destination_lng,
    });

    if (distMeters > ENDPOINT_TOLERANCE_METERS) {
      const distKm = Math.round((distMeters / 1000) * 10) / 10;
      return {
        hasPace: true,
        verdictSuppressed: true,
        suppressReason: 'endpoint_missed',
        distanceToDestinationKm: distKm,
        estimatedSec: estimated,
        actualSec: actual,
        movingSec: moving,
        deltaSec: delta,
        deltaMinutes,
        percentAhead: null,
        verdict: 'on_time',
        hasStopGap,
        sourceLabel,
        verdictTitle: 'ENDED SHORT OF DESTINATION',
        verdictDescription: `Ride ended ${distKm} km short of your destination. Pace verdict withheld.`,
      };
    }
  }

  // Build verdict title and description
  let verdictTitle = 'RIGHT ON TIME';
  let verdictDescription = 'You reached your destination right on time.';

  if (verdict === 'faster') {
    verdictTitle = deltaMinutes <= 1 ? '1 MINUTE FASTER' : `${deltaMinutes} MINUTES FASTER`;
    verdictDescription = percentAhead !== null
      ? `You reached your destination ${percentAhead}% ahead of the estimated time.`
      : `You reached your destination ${deltaMinutes} ${deltaMinutes === 1 ? 'minute' : 'minutes'} ahead of the estimated time.`;
  } else if (verdict === 'slower') {
    verdictTitle = deltaMinutes <= 1 ? '1 MINUTE SLOWER' : `${deltaMinutes} MINUTES SLOWER`;
    verdictDescription = percentAhead !== null
      ? `You reached your destination ${percentAhead}% behind the estimated time.`
      : `You reached your destination ${deltaMinutes} ${deltaMinutes === 1 ? 'minute' : 'minutes'} behind the estimated time.`;
  }

  return {
    hasPace: true,
    verdictSuppressed: false,
    estimatedSec: estimated,
    actualSec: actual,
    movingSec: moving,
    deltaSec: delta,
    deltaMinutes,
    percentAhead,
    verdict,
    hasStopGap,
    sourceLabel,
    verdictTitle,
    verdictDescription,
  };
}
