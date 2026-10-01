# Design Decisions

## 1. Job Pickup Strategy

**Approach chosen:** I used pg-boss on top of PostgreSQL. Workers poll the queue tables and claim jobs with row locks, so two workers never take the same job. One worker application registers a handler for every queue (email, webhook, aircraft report).

**Why:** The queue lives in the same database as the application data. Creating a job and enqueueing it happen in one PostgreSQL transaction, so a job cannot be lost or duplicated between the database and a broker, and there is no need for a transactional outbox. Idempotency is a unique key in the same database. It is also the simplest option to build and run, because there is no extra infrastructure.

**Trade-offs:** Throughput and scale. Kafka or RabbitMQ would handle far more jobs, and they push messages instead of being polled. What I gained is one system to run, transactional enqueue, and simple idempotency. Concurrency is configured per queue, so in one worker process the limits of several queues add up.

---

## 2. Worker Crash Recovery

**Approach chosen:** pg-boss heartbeats. Every job is enqueued with `heartbeatSeconds: 30`, and the worker refreshes the heartbeat automatically while the handler runs. If the refreshes stop, pg-boss treats the attempt as failed and retries it, or fails it for good when the attempts are used up. On top of that, a recovery pass in the worker runs at startup and every 5 seconds. It compares jobs stored as `processing` with the queue state and fixes the stored status and activity log.

**Why:** Without a heartbeat, pg-boss waits for the job's expiry, which defaults to 15 minutes, before it notices a dead worker. A plain shorter expiry would kill any job that legitimately runs longer than that value. The heartbeat detects a dead worker, not a slow one, and it is a library feature, so I wrote no tracking of my own. Application state (`jobs` and `job_activity`) and queue state are written in separate steps, so the recovery pass exists to make them agree again after a crash.

**What happens if worker crashes mid-job:**

1. The worker stops refreshing the heartbeat.
2. pg-boss's maintenance notices within roughly 30 to 90 seconds (the 30 second window plus its check interval, 60 seconds by default) and moves the job to retry, after the backoff delay from section 4.
3. Any worker picks it up as the next attempt. Starting it records the earlier attempt as `worker_interrupted` in the activity log, so the history shows the crash.
4. If that was the last attempt, the job becomes `failed`. The recovery pass notices the queue state and writes the same terminal result to the stored job.
5. Side effects that already happened are made harmless by a per-job key: email delivery key `email-job:<id>`, webhook key `webhook-job:<id>` with one successful call per job, and one aircraft report per job. A repeated attempt reuses the stored result instead of sending or generating again.

**Trade-offs:** Detection takes up to about a minute and a half, not instant. A crash between an external call and its database record can leave a delivered call without a record until the retry writes it. The keys only help if a real provider honors them; the mocks do. A job that hangs but keeps its heartbeat alive is not detected.

---

## 3. Priority Queue Implementation

**Approach chosen:** Priority is an integer from 1 to 5, where 5 is the highest. It is stored on the job and passed to pg-boss, which orders eligible jobs by priority and then by creation time.

**Why:** The queue already supports it, so there is no custom ordering code.

**Trade-offs:** Priority only orders pickup. It does not interrupt a job that is already running, so a long low-priority job can delay an urgent one until it finishes. Several workers choose the best eligible job at the moment they poll, so there is no strict global order. Under constant high-priority load, low-priority jobs can starve.

---

## 4. Retry Backoff Strategy

**Approach chosen:** pg-boss exponential backoff with jitter, shared by every queue. Base delay is 5 seconds and the cap is 60 seconds. A job gets 4 attempts by default (the first try plus 3 retries); a submission can choose 1 to 10, and a manual retry of a failed job grants exactly one more attempt.

**Timing:** The delay roughly doubles with random jitter, starting around 5 to 10 seconds after the first failure, then about 10 to 20 seconds, then about 20 to 40 seconds, and never more than 60 seconds. The exact value is random, so I cannot promise 5, 10, 30.

**Why:** Doubling gives a failing dependency time to recover, and jitter stops many failed jobs from retrying at the same moment. I first built a fixed 5, 10, 30 second schedule, but pg-boss cannot express it, so I had to write the delay into a table owned by the library. I dropped it for the built-in option because it needs less code and no dependence on pg-boss internals. Input errors (invalid payload, unknown airport) skip the retries and fail at once, because retrying cannot change the outcome.

---

## 5. One Thing I Would Do Differently With More Time

I was short on time, so the structure is less polished than I wanted. I would clean up the architecture and decouple the jobs code from the individual job types and from pg-boss. Today the jobs repository reads and writes pg-boss tables directly (for status, retry and cancellation), and the three queue names are listed in two places. A thinner queue boundary would make the library easier to replace and the code easier to change.

Next in line:

- **Scale limits.** Workers poll instead of being pushed to, there is no cap on concurrency for the whole worker process (limits are per queue and add up), and the list search uses `ILIKE` on the payload with no index. Fine at this size, not at production size.
- **Crash detection.** The heartbeat gives about a minute and a half. A shorter maintenance interval, and a worker registry for the health check, would be next.
