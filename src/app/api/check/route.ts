import type { NextRequest } from 'next/server';

import { BubbleClientError, fetchBubbleLot } from '@/lib/bubbleClient';
import { getDimensionHierarchy } from '@/lib/dimensions';
import { buildCheckResponse, runValidators } from '@/services/check';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy':
    "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
};

const buildResponse = (body: unknown, status: number, code?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...(code ? { 'X-Check-Code': code } : {}),
    },
  });

const normalizeBoolean = (value: string | null): boolean | null => {
  if (value === null) {
    return null;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return null;
};

type Dependencies = {
  fetchBubbleLot: typeof fetchBubbleLot;
  getDimensionHierarchy: typeof getDimensionHierarchy;
};

export const createCheckHandler =
  ({ fetchBubbleLot, getDimensionHierarchy }: Dependencies) =>
  async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams;

    const id = searchParams.get('id')?.trim();
    const isLiveValue = normalizeBoolean(searchParams.get('isLive'));

    if (!id) {
      return buildResponse(
        { code: '999', message: 'Paramètre id manquant ou invalide' },
        400,
        '999'
      );
    }

    if (isLiveValue === null) {
      return buildResponse(
        { code: '999', message: 'Paramètre isLive manquant ou invalide' },
        400,
        '999'
      );
    }

    try {
      const lot = await fetchBubbleLot({ id, isLive: isLiveValue });
      const hierarchy = getDimensionHierarchy();
      const issues = runValidators(lot, { dimensionHierarchy: hierarchy });
      const result = buildCheckResponse(issues);

      return buildResponse(result, 200, result.code);
    } catch (error) {
      if (error instanceof BubbleClientError) {
        const body = error.body;
        const message =
          body && typeof body === 'object'
            ? ((body as { message?: string; error?: string }).message ??
              (body as { message?: string; error?: string }).error)
            : null;

        return buildResponse(
          {
            code: '999',
            message: message ?? 'Erreur Bubble',
          },
          error.status,
          '999'
        );
      }

      console.error('API Check - Erreur inattendue:', error);

      return buildResponse(
        {
          code: '999',
          message: error instanceof Error ? error.message : String(error),
        },
        500,
        '999'
      );
    }
  };

export const GET = createCheckHandler({
  fetchBubbleLot,
  getDimensionHierarchy,
});
