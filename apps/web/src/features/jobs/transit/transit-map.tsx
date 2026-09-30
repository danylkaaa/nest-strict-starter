import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';

import { formatNumber, formatMinutes, formatTime } from '@/shared/format';

import { flightSnapshot, unwrapLongitudes } from './flight-profile';

import type { TransitReport } from '@/features/jobs/job';

const ROUTE_COLOR = '#3182CE';
const MARKER_BORDER = '#2B6CB0';
const AIRPORT_FILL = '#1A202C';
// One hover marker for every other path point keeps the route readable
const MARKER_STEP = 2;

const utcTime = (iso: string) => `${iso.slice(11, 16)} UTC`;

export const TransitMap = ({ report }: { report: TransitReport }) => {
  const path = unwrapLongitudes(report.path);
  const positions = path.map((point): [number, number] => [point.lat, point.lon]);
  const lastIndex = path.length - 1;

  return (
    <MapContainer
      bounds={positions}
      boundsOptions={{ padding: [40, 40] }}
      scrollWheelZoom={false}
      style={{ height: '470px' }}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        maxZoom={18}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        pathOptions={{ color: ROUTE_COLOR, dashArray: '8 6', weight: 3 }}
        positions={positions}
      >
        <Tooltip sticky>
          <b>
            {report.origin.code} → {report.destination.code}
          </b>
          <br />
          {formatNumber(report.distanceKm)} km · {formatMinutes(report.durationMinutes)}
        </Tooltip>
      </Polyline>
      {path.map((point, index) => {
        const isAirport = index === 0 || index === lastIndex;
        if (!isAirport && index % MARKER_STEP !== 0) return null;
        const snapshot = flightSnapshot(
          point,
          report.aircraft,
          report.departureAt,
          report.durationMinutes,
        );
        const airport = index === 0 ? report.origin : report.destination;
        return (
          <CircleMarker
            center={[point.lat, point.lon]}
            key={point.fraction}
            pathOptions={{
              color: MARKER_BORDER,
              fillColor: isAirport ? AIRPORT_FILL : '#fff',
              fillOpacity: 1,
              weight: 2,
            }}
            radius={isAirport ? 8 : 5}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {isAirport ? (
                <>
                  <b>
                    {airport.code} · {airport.name}
                  </b>
                  <br />
                  {index === 0 ? 'Departure' : 'Arrival'} {utcTime(snapshot.at)}
                </>
              ) : (
                <>
                  <b>
                    {report.aircraft.callsign} · {report.aircraft.model}
                  </b>
                  <br />
                  {utcTime(snapshot.at)} ({formatTime(snapshot.at)} local)
                  <br />
                  Alt {formatNumber(snapshot.altitudeFt)} ft · {snapshot.speedKt} kt
                </>
              )}
              <br />
              {point.lat.toFixed(2)}°, {(((point.lon + 540) % 360) - 180).toFixed(2)}°
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
};
