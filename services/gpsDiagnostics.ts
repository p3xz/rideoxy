/**
 * Re-exports from gpsDebugLog for backward compatibility
 */
export * from './gpsDebugLog';

// Backward compatibility aliases
export {
  recordGpsDebugFix as recordGpsDiagnostic,
  getGpsDebugLogs as getGpsDiagnosticLogs,
  getGpsDebugLogCount as getGpsLogCount,
  clearGpsDebugLogs as clearGpsDiagnosticLogs,
  getFormattedGpsDebugLogs as getFormattedGpsLogs,
} from './gpsDebugLog';
