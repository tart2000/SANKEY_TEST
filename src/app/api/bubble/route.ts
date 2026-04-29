import { BubbleClientError, callBubble } from '@/lib/bubbleClient';

export async function POST(request: Request) {
  try {
    const { endpoint, params, method = 'GET' } = await request.json();
    const { data, status } = await callBubble({ endpoint, params, method });

    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Content-Security-Policy':
          "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
      },
    });
  } catch (err) {
    if (err instanceof BubbleClientError) {
      return new Response(JSON.stringify(err.body), {
        status: err.status,
        headers: {
          'Content-Type': 'application/json',
          'Content-Security-Policy':
            "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
        },
      });
    }

    console.error(
      '[bubble:route] unexpected_error',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    );
    return new Response(
      JSON.stringify({
        error: 'Erreur lors du fetch',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Content-Security-Policy':
            "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
        },
      }
    );
  }
}
