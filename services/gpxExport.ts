import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ride, TrackPoint } from '../types/ride';
import { getTrackPointsByRideId } from '../database/trackPointRepository';

export async function generateGPXString(ride: Ride, trackPoints: TrackPoint[]): Promise<string> {
  const rideDate = new Date(ride.start_time).toISOString();
  const formattedDate = new Date(ride.start_time).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const trkPointsXml = trackPoints
    .map((pt) => {
      const ptTime = new Date(pt.timestamp).toISOString();
      const eleTag = pt.altitude !== null ? `        <ele>${pt.altitude.toFixed(1)}</ele>\n` : '';
      const speedTag = pt.speed !== null ? `        <speed>${pt.speed.toFixed(2)}</speed>\n` : '';
      return (
        `      <trkpt lat="${pt.latitude.toFixed(6)}" lon="${pt.longitude.toFixed(6)}">\n` +
        eleTag +
        `        <time>${ptTime}</time>\n` +
        speedTag +
        `      </trkpt>`
      );
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rideoxy - Motorcycle Ride Tracker" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Rideoxy Ride - ${formattedDate}</name>
    <desc>Motorcycle ride tracked with Rideoxy. Distance: ${ride.distance.toFixed(1)} km, Moving Time: ${Math.round(ride.moving_time / 60)} min, Top Speed: ${Math.round(ride.max_speed)} km/h.</desc>
    <time>${rideDate}</time>
  </metadata>
  <trk>
    <name>Motorcycle Ride (${formattedDate})</name>
    <type>motorcycle</type>
    <trkseg>
${trkPointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

export async function exportRideToGPX(ride: Ride): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const trackPoints = await getTrackPointsByRideId(ride.id);
    if (trackPoints.length === 0) {
      return { success: false, error: 'No GPS trackpoints recorded for this ride.' };
    }

    const gpxContent = await generateGPXString(ride, trackPoints);
    const dateFormatted = new Date(ride.start_time).toISOString().replace(/[:.]/g, '-');
    const fileName = `rideoxy_ride_${dateFormatted}.gpx`;
    const gpxFile = new File(Paths.cache, fileName);

    await gpxFile.write(gpxContent);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(gpxFile.uri, {
        mimeType: 'application/gpx+xml',
        dialogTitle: `Export Rideoxy Ride (${ride.distance.toFixed(1)} km)`,
        UTI: 'com.topografix.gpx',
      });
      return { success: true, filePath: gpxFile.uri };
    } else {
      return { success: true, filePath: gpxFile.uri, error: 'Sharing not available on this platform.' };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
