import { NextResponse } from 'next/server';
import { prisma } from '@repo/database';

// Public, unauthenticated liveness/readiness check for load balancers and
// uptime monitors. Deliberately not wrapped in any auth guard — it must work
// without credentials. Never runs statically so every hit is a live check.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'ok', timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed: database unreachable', error);
    return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 });
  }
}
