import { NextRequest, NextResponse } from 'next/server';
import { runStore } from '@/lib/runner/runStore';

// ─── GET /api/runner/status/[id] ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = runStore.get(id);

  if (!state) {
    return NextResponse.json(
      { error: 'Run not found or already expired.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    runId: state.runId,
    status: state.status,
    message: state.message,
    logs: state.logs,
    startedAt: state.startedAt,
  });
}
