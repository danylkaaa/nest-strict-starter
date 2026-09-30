const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  second: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

const utcDateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

/** Local wall-clock time, e.g. "14:02:31" */
export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));

/** Calendar date in UTC, e.g. "3 Oct 2026" */
export const formatDate = (iso: string): string => dateFormat.format(new Date(iso));

/** Day and time in UTC, e.g. "3 Oct 09:00 UTC" */
export const formatUtcDateTime = (iso: string): string =>
  `${utcDateTimeFormat.format(new Date(iso)).replace(',', '')} UTC`;

/** "7 h 12 min", or "45 min" under an hour */
export const formatMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes} min`;
};

export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-US');

const SHORT_ID_LENGTH = 8;

/** First block of a UUID, enough to tell IDs apart on screen; the full value is copied on click */
export const shortId = (id: string): string => id.slice(0, SHORT_ID_LENGTH);
