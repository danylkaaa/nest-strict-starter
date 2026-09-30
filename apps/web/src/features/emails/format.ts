const SHORT_ID_LENGTH = 8;

export const shortenId = (id: string): string => id.slice(0, SHORT_ID_LENGTH);

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatTimestamp = (iso: string): string => timestampFormat.format(new Date(iso));
