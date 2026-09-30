import { Grid, Stack } from '@chakra-ui/react';

import { formatMinutes, formatNumber, formatUtcDateTime } from '@/shared/format';
import { KeyValueList } from '@/shared/ui/key-value-list';
import { Panel } from '@/shared/ui/panel';

import { TransitMap } from './transit-map';

import type { TransitReport } from '@/features/jobs/job';

export const TransitReportView = ({ report }: { report: TransitReport }) => (
  <Grid alignItems="start" gap="5" templateColumns="minmax(0, 1fr) 300px">
    <Panel overflow="hidden" p="0">
      <TransitMap report={report} />
    </Panel>
    <Stack gap="5">
      <Panel title="Aircraft">
        <KeyValueList
          items={[
            { label: 'Model', value: report.aircraft.model },
            { label: 'Registration', value: report.aircraft.registration },
            { label: 'Callsign', value: report.aircraft.callsign },
            { label: 'Cruise alt.', value: `${formatNumber(report.aircraft.cruiseAltitudeFt)} ft` },
            { label: 'Cruise speed', value: `${report.aircraft.cruiseSpeedKt} kt` },
          ]}
        />
      </Panel>
      <Panel title="Transit">
        <KeyValueList
          items={[
            { label: 'Origin', value: `${report.origin.code} · ${report.origin.city}` },
            {
              label: 'Destination',
              value: `${report.destination.code} · ${report.destination.city}`,
            },
            { label: 'Departed', value: formatUtcDateTime(report.departureAt) },
            { label: 'Arrived', value: formatUtcDateTime(report.arrivalAt) },
            { label: 'Distance', value: `${formatNumber(report.distanceKm)} km` },
            { label: 'Duration', value: formatMinutes(report.durationMinutes) },
          ]}
        />
      </Panel>
    </Stack>
  </Grid>
);
