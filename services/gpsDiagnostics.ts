import { Platform } from 'react-native';

export type GpsDecision = 'accepted' | 'still' | 'rejected';

export interface GpsDiagnosticEntry {
  timestamp: number;
  timeStr: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  reportedSpeed: number | null; // Speed reported by OS (m/s), null if unknown/<0
  derivedSpeed: number | null;  // Speed derived from coordinates (m/s)
  distanceFromLastAccepted: number; // Meters from previous accepted fix
  decision: GpsDecision;
  reason?: string;
  isStill: boolean;
  mocked?: boolean;
}

const MAX_BUFFER_SIZE = 300;
let isLoggingEnabled = false;
const ringBuffer: GpsDiagnosticEntry[] = [];

/**
 * Returns whether GPS diagnostics ring buffer is currently enabled.
 */
export function isGpsLoggingEnabled(): boolean {
  return isLoggingEnabled;
}

/**
 * Enables or disables GPS diagnostics logging.
 * When disabled, the in-memory buffer is cleared immediately to free memory.
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
export function recordGpsDiagnostic(
  entry: Omit<GpsDiagnosticEntry, 'timeStr'>
): void {
  const timeStr = new Date(entry.timestamp).toISOString().slice(11, 23);

  // Formatted diagnostic line
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
 * Returns current snapshot of logged entries.
 */
export function getGpsDiagnosticLogs(): GpsDiagnosticEntry[] {
  return [...ringBuffer];
}

/**
 * Returns the count of currently buffered entries.
 */
export function getGpsLogCount(): number {
  return ringBuffer.length;
}

/**
 * Clears the in-memory buffer.
 */
export function clearGpsDiagnosticLogs(): void {
  ringBuffer.length = 0;
}

/**
 * Formats the ring buffer as a clean text table ready for clipboard copy.
 */
export function getFormattedGpsLogs(): string {
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
    `-----------------------------------------------------------------------------------------\n` +
    `TIME (UTC)   | STATUS   | STILL | DIST (m) | REPSPD (km/h) | CALC (km/h) | ACC (m) | DETAILS\n` +
    `-----------------------------------------------------------------------------------------\n`;

  const rows = ringBuffer
    .map((e) => {
      const time = e.timeStr.padEnd(12);
      const status = e.decision.toUpperCase().padEnd(8);
      const still = (e.isStill ? 'YES' : 'NO').padEnd(5);
      const dist = e.distanceFromLastAccepted.toFixed(1).padStart(8);
      const repSpd =
        e.reportedSpeed !== null
          ? (e.reportedSpeed * 3.6).toFixed(1).padStart(13)
          : '      unknown';
      const calcSpd =
        e.derivedSpeed !== null
          ? (e.derivedSpeed * 3.6).toFixed(1).padStart(11)
          : '       0.0';
      const acc = e.accuracy !== null ? e.accuracy.toFixed(1).padStart(7) : '   null';
      const reason = e.reason ? ` [${e.reason}]` : '';
      return `${time} | ${status} | ${still} | ${dist} | ${repSpd} | ${calcSpd} | ${acc} |${reason}`;
    })
    .join('\n');

  return header + rows;
}
