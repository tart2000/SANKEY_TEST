import { BubbleClientError, callBubble } from '@/lib/bubbleClient';
import { mergeLots } from '@/lib/mergeLots';
import type { Lot } from '@/lib/mergeLots';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Content-Security-Policy':
    "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
};

const isBetween = (value: number, min: number, max: number) =>
  value >= min && value <= max;

const buildResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return buildResponse(
        {
          error: 'Corps de requête JSON invalide',
        },
        400
      );
    }

    if (!isRecord(rawBody)) {
      return buildResponse(
        {
          error: 'Corps de requête JSON invalide',
        },
        400
      );
    }

    const { id1, id2, isLive } = rawBody;

    if (typeof id1 !== 'string' || id1.trim() === '') {
      return buildResponse(
        {
          error: 'Paramètre id1 manquant ou invalide',
        },
        400
      );
    }

    if (typeof id2 !== 'string' || id2.trim() === '') {
      return buildResponse(
        {
          error: 'Paramètre id2 manquant ou invalide',
        },
        400
      );
    }

    if (id1 === id2) {
      return buildResponse(
        {
          error: 'Les identifiants doivent être différents',
        },
        400
      );
    }

    const normalizedIsLive =
      isLive === true || isLive === 'true'
        ? true
        : isLive === false || isLive === 'false'
          ? false
          : isLive;

    if (typeof normalizedIsLive !== 'boolean') {
      return buildResponse(
        {
          error: 'Paramètre isLive manquant ou invalide',
        },
        400
      );
    }

    const [lot1Result, lot2Result] = await Promise.all([
      callBubble({
        endpoint: 'lot',
        params: { id: id1, isLive: normalizedIsLive },
        method: 'POST',
      }),
      callBubble({
        endpoint: 'lot',
        params: { id: id2, isLive: normalizedIsLive },
        method: 'POST',
      }),
    ]);

    if (!isBetween(lot1Result.status, 200, 299)) {
      return buildResponse(
        {
          error: "Impossible de charger le lot d'origine",
          message:
            'Bubble a renvoyé une erreur en récupérant le lot lié à id1.',
          bubbleResponse: lot1Result.data,
        },
        lot1Result.status
      );
    }

    if (!isBetween(lot2Result.status, 200, 299)) {
      return buildResponse(
        {
          error: 'Impossible de charger le lot à fusionner',
          message:
            'Bubble a renvoyé une erreur en récupérant le lot lié à id2.',
          bubbleResponse: lot2Result.data,
        },
        lot2Result.status
      );
    }

    if (!isRecord(lot1Result.data) || !isRecord(lot2Result.data)) {
      return buildResponse(
        {
          error: 'Le format du lot renvoyé par Bubble est inattendu',
          message:
            "Bubble n'a pas renvoyé un objet lot exploitable. Vérifiez que le workflow renvoie bien le JSON complet.",
          details: {
            lot1: lot1Result.data,
            lot2: lot2Result.data,
          },
        },
        502
      );
    }

    const lot1 = lot1Result.data as Lot;
    const lot2 = lot2Result.data as Lot;

    const mergedLot = mergeLots([lot1, lot2]) as Lot;

    mergedLot.title = 'merged';
    mergedLot.frequency = (lot1 as Lot).frequency ?? null;

    return buildResponse(mergedLot, 200);
  } catch (err) {
    if (err instanceof BubbleClientError) {
      return buildResponse(err.body, err.status);
    }

    console.error('API Merge - Erreur inattendue:', err);

    return buildResponse(
      {
        error: 'Erreur lors de la fusion des lots',
        message: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}
