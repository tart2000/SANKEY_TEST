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
import type { Lot } from '@/lib/selectByCore';
import type { Cdc } from '@/services/cdc/applyCdc';
import { buildScenarioFromCdc } from '@/services/cdc/buildScenarioFromCdc';

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

  if (!cdcId || !lotId) {
    return buildResponse(
      {
        error: 'cdc_and_lot_required',
        message: 'Les paramètres "cdc" et "lot" sont obligatoires.',
      },
      400
    );
  }

  const [lot, cdc] = await Promise.all([
    fetchBubbleLot({ id: lotId, isLive }),
    fetchCdc({ id: cdcId, isLive }),
  ]);

  const hierarchy = getDimensionHierarchy();
  const processingOrder = getDimensionProcessingOrder();

  try {
    await fetchTransfosInfo({ isLive });
  } catch (error) {
    console.error(
      '[create_scenario] Erreur lors du chargement de transfos_info (ignorée pour la génération de scénario)',
      error
    );
  }

  const scenario = buildScenarioFromCdc(
    lot as Lot,
    cdc as Cdc,
    hierarchy,
    processingOrder
  );

  return buildResponse(scenario, 200);
}
