import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';

// Public, unauthenticated liveness/readiness check for load balancers and
// uptime monitors. Deliberately not wrapped in any auth guard — it must work
// without credentials. Never runs statically so every hit is a live check.
export const dynamic = 'force-dynamic';

/** A job waiting longer than this means no worker is taking work. */
const JOBS_DELAYED_AFTER_SECONDS = 10 * 60;

/**
 * 'delayed' when background jobs are stuck. The check still answers 200,
 * because the shop can serve customers; an uptime monitor can alert on the
 * field. Only the word is public, never counts or job details.
 */
async function jobsState(): Promise<'ok' | 'delayed' | 'unknown'> {
  try {
    const rows = await prisma.$queryRaw<{ seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM (timezone('UTC', now()) - MIN("run_at")))::float8 AS seconds
      FROM "jobs" WHERE "status" = 'PENDING' AND "run_at" <= timezone('UTC', now())
    `;
    const seconds = rows[0]?.seconds ?? null;
    return seconds !== null && seconds > JOBS_DELAYED_AFTER_SECONDS ? 'delayed' : 'ok';
  } catch {
    return 'unknown';
  }
}

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;
    const jobs = await jobsState();
    if (jobs === 'delayed') {
      console.warn(JSON.stringify({ type: 'health.jobs-delayed', at: new Date().toISOString() }));
    }
    return NextResponse.json(
      { status: 'ok', db: 'ok', dbMs, jobs, timestamp: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Health check failed: database unreachable', error);
    return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
