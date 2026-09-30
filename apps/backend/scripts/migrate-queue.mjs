import { PgBoss } from 'pg-boss';

// Keep in sync with QUEUES in src/common/queue/queue.service.ts (queue.service.spec.ts checks it).
const queues = ['email', 'webhook', 'aircraft-report'];

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to migrate the job queues.');

const boss = new PgBoss({ connectionString: url });
boss.on('error', () => {
  process.stderr.write('pg-boss connection or maintenance failure\n');
});

try {
  await boss.start();
  for (const name of queues) await boss.createQueue(name);
} finally {
  await boss.stop();
}
