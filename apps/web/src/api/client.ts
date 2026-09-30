import { mockAirports, mockServer } from '@/mock/runtime';

import type {
  Airport,
  Job,
  ListEmailsQuery,
  ListJobsQuery,
  Page,
  QueueHealth,
  SentEmail,
  SubmitJobInput,
  SubmitJobResponse,
} from '@/features/jobs/job';

// API client. Every call is served by the in-browser mock server for now; each function maps to
// one backend endpoint (noted alongside) so switching to `fetch` later leaves callers unchanged.

const LATENCY_MS = 150;

const respond = async <T>(handler: () => T): Promise<T> => {
  await new Promise((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });
  // Clone so callers never hold references into the mock server's state, as with real JSON
  return structuredClone(handler());
};

export const api = {
  // POST /jobs/:id/cancel
  cancelJob: (id: string): Promise<Job> => respond(() => mockServer.cancelJob(id)),
  // GET /health
  getHealth: (): Promise<QueueHealth> => respond(() => mockServer.getHealth()),
  // GET /jobs/:id
  getJob: (id: string): Promise<Job> => respond(() => mockServer.getJob(id)),
  // GET /airports
  listAirports: (): Promise<readonly Airport[]> => respond(() => mockAirports),
  // GET /emails?status=&search=&page=
  listEmails: (query: ListEmailsQuery): Promise<Page<SentEmail>> =>
    respond(() => mockServer.listEmails(query)),
  // GET /jobs?status=&type=&search=&page=
  listJobs: (query: ListJobsQuery): Promise<Page<Job>> => respond(() => mockServer.listJobs(query)),
  // POST /jobs/:id/retry
  retryJob: (id: string): Promise<Job> => respond(() => mockServer.retryJob(id)),
  // POST /jobs (Idempotency-Key header when set)
  submitJob: (input: SubmitJobInput): Promise<SubmitJobResponse> =>
    respond(() => mockServer.submitJob(input)),
};
