import type { NextRequest } from 'next/server';

import {
  fetchCdc,
  fetchBubbleLot,
  fetchTransfosInfo,
} from '@/lib/bubbleClient';
import {
  getDimensionHierarchy,
  getDimensionProcessingOrder,
} from '@/lib/dimensions';
import { buildDynamicRules, type DynamicRule } from '@/lib/dynamicTransfos';
import { getTranslationTypes } from '@/lib/translationsConfig';
import { applyCdc, type Cdc } from '@/services/cdc/applyCdc';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Content-Security-Policy':
    "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
};

const buildResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const cdcId = typeof body.cdc === 'string' ? body.cdc.trim() : undefined;
  const lotId = typeof body.lot === 'string' ? body.lot.trim() : undefined;
  const isLive =
    body.isLive === true || body.isLive === 'true' || body.isLive === '1';

  const [lot, cdc] = await Promise.all([
    fetchBubbleLot({ id: lotId!, isLive }),
    fetchCdc({ id: cdcId!, isLive }),
  ]);

  const hierarchy = getDimensionHierarchy();
  const processingOrder = getDimensionProcessingOrder();

  const translationTypes = getTranslationTypes();
  const translationRules = Object.values(translationTypes).map(def => ({
    dimension: def.dimension,
    outputId: isLive ? def.output_id_live : def.output_id_test,
  }));

  let dynamicRules: DynamicRule[] = [];
  try {
    const transfosInfo = await fetchTransfosInfo({ isLive });
    dynamicRules = buildDynamicRules(transfosInfo);
  } catch (error) {
    console.error(
      '[compare] Erreur lors du chargement de transfos_info, fallback sans règles dynamiques',
      error
    );
  }

  const result = applyCdc(
    lot as Record<string, unknown>,
    cdc as Cdc,
    hierarchy,
    processingOrder,
    { translationRules, dynamicRules }
  );

  return buildResponse(result, 200);
}
