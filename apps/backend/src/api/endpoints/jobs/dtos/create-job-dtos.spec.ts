import { describe, expect, it } from 'vitest';

import { CreateAircraftReportJobSchema } from './create-aircraft-report-job.dto.js';
import { CreateWebhookJobSchema } from './create-webhook-job.dto.js';

const envelope = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  priority: 3,
  type: 'instant',
};

describe('createWebhookJobSchema', () => {
  const payload = { payload: { hello: 'world' }, url: 'https://example.com/hook' };

  it('accepts an http(s) URL with a JSON payload', () => {
    expect(CreateWebhookJobSchema.safeParse({ ...envelope, payload }).success).toBe(true);
  });

  it.each(['not a url', 'ftp://example.com/hook', 'javascript:alert(1)'])(
    'rejects the URL %s',
    (url) => {
      expect(
        CreateWebhookJobSchema.safeParse({ ...envelope, payload: { ...payload, url } }).success,
      ).toBe(false);
    },
  );

  it('keeps the shared envelope rules', () => {
    expect(
      CreateWebhookJobSchema.safeParse({ ...envelope, payload, type: 'schedule' }).success,
    ).toBe(false);
    expect(CreateWebhookJobSchema.safeParse({ ...envelope, payload, priority: 9 }).success).toBe(
      false,
    );
  });
});

describe('createAircraftReportJobSchema', () => {
  const payload = {
    aircraftId: 'acf_1',
    departureAt: '2031-01-01T10:00:00Z',
    destinationIcao: 'KSFO',
    originIcao: 'RJTT',
  };

  it('accepts a transit request', () => {
    expect(CreateAircraftReportJobSchema.safeParse({ ...envelope, payload }).success).toBe(true);
  });

  it('rejects a malformed ICAO code and a non-ISO departure', () => {
    expect(
      CreateAircraftReportJobSchema.safeParse({
        ...envelope,
        payload: { ...payload, originIcao: 'RJT' },
      }).success,
    ).toBe(false);
    expect(
      CreateAircraftReportJobSchema.safeParse({
        ...envelope,
        payload: { ...payload, departureAt: 'tomorrow' },
      }).success,
    ).toBe(false);
  });
});
