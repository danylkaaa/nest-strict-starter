import { PgBoss } from 'pg-boss';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to migrate the email queue.');

const boss = new PgBoss({ connectionString: url });
boss.on('error', () => {
  process.stderr.write('pg-boss connection or maintenance failure\n');
});

try {
  await boss.start();
  await boss.createQueue('email');
} finally {
  await boss.stop();
}
