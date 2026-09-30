import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');

if (existsSync(envPath)) {
  process.stdout.write('Using existing .env\n');
} else {
  copyFileSync(resolve(root, '.env.example'), envPath);
  process.stdout.write('Created .env from .env.example\n');
}

let contents = readFileSync(envPath, 'utf8');
const values = new Map();

for (const line of contents.split(/\r?\n/u)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
  if (!match) continue;

  const rawValue = match[2];
  const isQuoted =
    rawValue.length >= 2 &&
    ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'")));
  values.set(match[1], isQuoted ? rawValue.slice(1, -1) : rawValue);
}

const required = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_PORT', 'DATABASE_NAME'];
const missing = required.filter((key) => !values.get(key));
if (missing.length > 0) {
  throw new Error(`Set ${missing.join(', ')} in .env before running setup.`);
}

const port = Number(values.get('POSTGRES_PORT'));
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('POSTGRES_PORT in .env must be an integer from 1 to 65535.');
}

const databaseUrl = new URL('postgresql://localhost');
databaseUrl.username = values.get('POSTGRES_USER');
databaseUrl.password = values.get('POSTGRES_PASSWORD');
databaseUrl.port = String(port);
databaseUrl.pathname = `/${encodeURIComponent(values.get('DATABASE_NAME'))}`;

const existingUrl = values.get('DATABASE_URL');
if (existingUrl) {
  if (existingUrl !== databaseUrl.href) {
    throw new Error(
      'DATABASE_URL in .env differs from the local PostgreSQL settings. Update it before setup.',
    );
  }
} else {
  const line = `DATABASE_URL=${databaseUrl.href}`;
  contents = /^\s*DATABASE_URL\s*=/mu.test(contents)
    ? contents.replace(/^\s*DATABASE_URL\s*=.*$/mu, line)
    : `${contents.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, contents);
  process.stdout.write('Set DATABASE_URL in .env from PostgreSQL settings\n');
}

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, { cwd: root, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const environment = {
  ...process.env,
  DATABASE_NAME: values.get('DATABASE_NAME'),
  DATABASE_URL: databaseUrl.href,
  POSTGRES_PASSWORD: values.get('POSTGRES_PASSWORD'),
  POSTGRES_PORT: values.get('POSTGRES_PORT'),
  POSTGRES_USER: values.get('POSTGRES_USER'),
};

run('docker', ['compose', 'up', '-d', '--wait', 'postgres'], environment);
run('pnpm', ['run', 'db:migrate'], environment);
