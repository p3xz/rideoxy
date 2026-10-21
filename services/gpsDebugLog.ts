import { Platform } from 'react-native';

export type GpsDecision = 'accepted' | 'still' | 'demoted' | 'rejected';

export interface GpsDebugLogEntry {
  timestamp: number;
  timeStr: string;
  accuracy: number | null;
  reportedSpeed: number | null; // m/s, null if unknown/<0
  derivedSpeed: number | null;  // m/s
  distanceFromLastAccepted: number; // meters from previous accepted fix
  decision: GpsDecision;
  reason?: string;
  isStill: boolean;
  mocked?: boolean;
}

const MAX_BUFFER_SIZE = 300;
let isLoggingEnabled = false;
const ringBuffer: GpsDebugLogEntry[] = [];

/**
 * Returns whether the GPS debug ring buffer is currently enabled.
 */
export function isGpsLoggingEnabled(): boolean {
  return isLoggingEnabled;
}

/**
 * Enables or disables GPS debug logging.
 * When disabled, the in-memory buffer is cleared immediately (zero buffer overhead).
 */
export function setGpsLoggingEnabled(enabled: boolean): void {
  isLoggingEnabled = enabled;
  if (!enabled) {
    ringBuffer.length = 0;
  }
}

/**
 * Records a single GPS telemetry fix evaluation into the ring buffer and/or console.
 * - Under __DEV__, always console.logs the line.
 * - In release builds, only buffers when isLoggingEnabled === true.
 * - Fixed ring buffer cap: 300 entries maximum.
 */
export function recordGpsDebugFix(
  entry: Omit<GpsDebugLogEntry, 'timeStr'>
): void {
  const timeStr = new Date(entry.timestamp).toISOString().slice(11, 23);

  const formattedLine = `[GPS_${entry.decision.toUpperCase()}] ${timeStr} | acc=${
    entry.accuracy !== null ? `${entry.accuracy.toFixed(1)}m` : 'null'
  } | repSpd=${
    entry.reportedSpeed !== null ? `${(entry.reportedSpeed * 3.6).toFixed(1)}km/h` : 'unknown'
  } | calcSpd=${
    entry.derivedSpeed !== null ? `${(entry.derivedSpeed * 3.6).toFixed(1)}km/h` : '0km/h'
  } | d=${entry.distanceFromLastAccepted.toFixed(2)}m | still=${entry.isStill} | ${
    entry.decision
  }${entry.reason ? ` (${entry.reason})` : ''}`;

  if (__DEV__) {
    console.log(formattedLine);
  }

  // Zero buffer overhead when logging is turned OFF
  if (!isLoggingEnabled) {
    return;
  }

  if (ringBuffer.length >= MAX_BUFFER_SIZE) {
    ringBuffer.shift();
  }

  ringBuffer.push({
    ...entry,
    timeStr,
  });
}

/**
 * Returns a snapshot of logged entries.
 */
export function getGpsDebugLogs(): GpsDebugLogEntry[] {
  return [...ringBuffer];
}

/**
 * Returns the count of currently buffered entries.
 */
export function getGpsDebugLogCount(): number {
  return ringBuffer.length;
}

/**
 * Clears the in-memory buffer.
 */
export function clearGpsDebugLogs(): void {
  ringBuffer.length = 0;
}

/**
 * Formats the ring buffer as clean text ready for clipboard copy.
 */
export function getFormattedGpsDebugLogs(): string {
  if (ringBuffer.length === 0) {
    return (
      `RIDEOXY GPS DEBUG LOG\n` +
      `Status: Enabled, 0 fixes recorded yet.\n` +
      `Platform: ${Platform.OS} ${String(Platform.Version)}\n` +
      `Start or resume a ride to capture live GPS telemetry points.`
    );
  }

  const header =
    `RIDEOXY GPS DEBUG LOG (${ringBuffer.length} fixes)\n` +
    `Generated: ${new Date().toISOString()}\n` +
    `Platform: ${Platform.OS} ${String(Platform.Version)}\n` +
    `Format: [DECISION] HH:mm:ss.sss | acc | repSpd | calcSpd | dist | still | decision (reason)\n` +
    `─────────────────────────────────────────────────────────────────────────────\n`;

  const lines = ringBuffer.map((e) => {
    const acc = e.accuracy !== null ? `${e.accuracy.toFixed(1)}m` : 'null';
    const repSpd = e.reportedSpeed !== null ? `${(e.reportedSpeed * 3.6).toFixed(1)}km/h` : 'unknown';
    const calcSpd = e.derivedSpeed !== null ? `${(e.derivedSpeed * 3.6).toFixed(1)}km/h` : '0km/h';
    const d = `${e.distanceFromLastAccepted.toFixed(2)}m`;
    const reason = e.reason ? ` - ${e.reason}` : '';
    return `[${e.decision.toUpperCase().padEnd(8)}] ${e.timeStr} | acc=${acc} | rep=${repSpd} | calc=${calcSpd} | d=${d} | still=${e.isStill}${reason}`;
  });

  return header + lines.join('\n');
}
