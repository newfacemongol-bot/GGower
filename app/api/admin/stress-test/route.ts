import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { runAllTests } from '@/lib/stress-tests';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const s = await getSession();
  if (!s || s.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const result of runAllTests()) {
          controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              id: 'runner',
              category: 'Runner',
              name: 'Exception',
              status: 'fail',
              message: (e as Error).message,
              durationMs: 0,
            }) + '\n',
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
