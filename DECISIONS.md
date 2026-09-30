# Design Decisions

## 1. Job Pickup Strategy

I used pg-boss on top of PostgreSQL. Workers poll the queue tables and claim jobs with row locks, so two workers never take the same job. One worker application registers a handler for every queue (email, webhook, aircraft report).

The main reason is that the queue lives in the same database as the application data. Creating a job and enqueueing it happen in one PostgreSQL transaction, so a job cannot be lost or duplicated between the database and a broker, and there is no need for a transactional outbox. Idempotency is a unique key in the same database. It is also the simplest option to build and run, because there is no extra infrastructure.

The trade-off is throughput and scale. Kafka or RabbitMQ would handle far more jobs, and they push messages instead of being polled. What I gained is one system to run, transactional enqueue, and simple idempotency. Concurrency is configured per queue, so in one worker process the limits of several queues add up.

---

## 2. Worker Crash Recovery

TODO

---

## 3. Priority Queue Implementation

Priority is an integer from 1 to 5, where 5 is the highest. It is stored on the job and passed to pg-boss, which orders eligible jobs by priority and then by creation time. I chose this because the queue already supports it, so there is no custom ordering code.

The cost is that priority only orders pickup. It does not interrupt a job that is already running, so a long low-priority job can delay an urgent one until it finishes. Several workers choose the best eligible job at the moment they poll, so there is no strict global order. Under constant high-priority load, low-priority jobs can starve.

---

## 4. Retry Backoff Strategy

TODO

---

## 5. One Thing I Would Do Differently With More Time

TODO
