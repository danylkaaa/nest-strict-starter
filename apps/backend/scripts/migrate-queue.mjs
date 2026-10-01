import { PgBoss } from 'pg-boss';

// Keep in sync with QUEUES in src/common/queue/queue.service.ts (queue.service.spec.ts checks it).
const queues = ['email', 'webhook', 'aircraft-report'];

const { DATABASE_NAME, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } =
  process.env;
const missing = Object.entries({
  DATABASE_NAME,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_USER,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  throw new Error(`${missing.join(', ')} required to migrate the job queues.`);
}

const boss = new PgBoss({
  database: DATABASE_NAME,
  host: (POSTGRES_HOST === '' ? undefined : POSTGRES_HOST) ?? 'localhost',
  password: POSTGRES_PASSWORD,
  port: Number(POSTGRES_PORT),
  user: POSTGRES_USER,
});
boss.on('error', () => {
  process.stderr.write('pg-boss connection or maintenance failure\n');
});

try {
  await boss.start();
  for (const name of queues) await boss.createQueue(name);
} finally {
  await boss.stop();
}
