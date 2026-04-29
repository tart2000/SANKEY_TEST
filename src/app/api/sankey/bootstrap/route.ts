import { BubbleClientError, callBubble } from '@/lib/bubbleClient';

type BootstrapBody = {
  lotId?: string;
  scenarioId?: string;
  teamId?: string;
  isLive?: boolean;
};

const COMMON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BootstrapBody;
    const { lotId, scenarioId, teamId, isLive = false } = body || {};

    const tasks = {
      lot: lotId
        ? callBubble({
            endpoint: 'lot',
            method: 'POST',
            params: { id: lotId, isLive },
          })
        : Promise.resolve({ status: 200, data: null }),
      scenario: scenarioId
        ? callBubble({
            endpoint: 'scenario',
            method: 'POST',
            params: { id: scenarioId, isLive },
          })
        : Promise.resolve({ status: 200, data: null }),
      team: teamId
        ? callBubble({
            endpoint: 'team',
            method: 'POST',
            params: { id: teamId, isLive },
          })
        : Promise.resolve({ status: 200, data: null }),
      transfos: callBubble({
        endpoint: 'transfos',
        method: 'GET',
        params: { isLive },
      }),
      steps: callBubble({
        endpoint: 'steps',
        method: 'GET',
        params: { isLive },
      }),
      dimensions: callBubble({
        endpoint: 'dimensions',
        method: 'GET',
        params: { isLive },
      }),
    };

    const keys = Object.keys(tasks) as (keyof typeof tasks)[];
    const results = await Promise.allSettled(Object.values(tasks));

    const payload: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    keys.forEach((k, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        payload[k] = r.value.data;
      } else {
        payload[k] = null;
        const reason = r.reason;
        errors[k] = reason instanceof Error ? reason.message : String(reason);
      }
    });

    const responseBody = {
      ...payload,
      _errors: Object.keys(errors).length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: COMMON_HEADERS,
    });
  } catch (err) {
    if (err instanceof BubbleClientError) {
      return new Response(JSON.stringify(err.body), {
        status: err.status,
        headers: COMMON_HEADERS,
      });
    }

    console.error(
      '[bootstrap:route] unexpected_error',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    );

    return new Response(
      JSON.stringify({
        error: 'bootstrap_failed',
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: COMMON_HEADERS }
    );
  }
}
