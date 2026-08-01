import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { NextResponse } from 'next/server';

// DEV-ONLY shim for /api/analyze.
//
// In production the batch analysis is the Vercel Python serverless function at
// `web/api/analyze.py` (POST /api/analyze). `next dev` does NOT execute Vercel
// Python functions, so for local development the Run tab POSTs here instead
// (selected by NODE_ENV in web/lib/analysis.tsx). This handler runs the SAME
// Python file as a CLI — exactly mirroring how web/lib/cycle.ts spawns cycle.py
// for the Stock Detail page in dev. It returns 404 in production and is never
// called there, so it can't affect the deployed app.

export const dynamic = 'force-dynamic';

/**
 * Mirrors `analyze.py::_json` so the shim can't be quietly more permissive than the
 * function it stands in for. Without it this route sent NO `Cache-Control` at all on its
 * 200 — the proxy supplied one only on the 402 — which meant a local or e2e check of the
 * success path could never have caught a regression in production's header. A dev stand-in
 * that behaves differently from production is a test that lies. (Live-check Session 2.)
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400, headers: NO_STORE });
  }

  // `next dev` runs with cwd = web/ (pnpm --dir web dev); fall back to repo root.
  const candidates = [
    path.join(process.cwd(), 'api', 'analyze.py'),
    path.join(process.cwd(), 'web', 'api', 'analyze.py'),
  ];
  const script = candidates.find((p) => existsSync(p));
  if (!script) {
    return NextResponse.json(
      { error: 'analyze.py not found (dev)' },
      { status: 500, headers: NO_STORE },
    );
  }

  const python = process.env.PYTHON_BIN || 'python';

  const { code, stdout } = await new Promise<{ code: number; stdout: string }>((resolve) => {
    const child = spawn(python, [script], { env: process.env });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => resolve({ code: 1, stdout: '' }));
    child.on('close', (c) => resolve({ code: c ?? 1, stdout: out }));
    child.stdin.write(JSON.stringify(body));
    child.stdin.end();
  });

  try {
    const parsed = JSON.parse(stdout);
    // analyze.py exits 0 on success, non-zero on a 400/500 (and prints {error:…}).
    return NextResponse.json(parsed, { status: code === 0 ? 200 : 400, headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: 'analyze failed (dev)', detail: stdout.slice(0, 500) },
      { status: 500, headers: NO_STORE },
    );
  }
}
