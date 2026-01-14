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

    const { lots, isLive } = rawBody;

    if (!Array.isArray(lots) || lots.length === 0) {
      return buildResponse(
        {
          error: 'Paramètre lots manquant ou invalide',
          message: 'lots doit être un array non vide',
        },
        400
      );
    }

    for (let i = 0; i < lots.length; i++) {
      if (typeof lots[i] !== 'string' || lots[i].trim() === '') {
        return buildResponse(
          {
            error: `Paramètre lots[${i}] invalide`,
            message:
              'Tous les éléments de lots doivent être des strings non vides',
          },
          400
        );
      }
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

    const lotResults = await Promise.all(
      lots.map((id: string) =>
        callBubble({
          endpoint: 'lot',
          params: { id, isLive: normalizedIsLive },
          method: 'POST',
        })
      )
    );

    for (let i = 0; i < lotResults.length; i++) {
      if (!isBetween(lotResults[i].status, 200, 299)) {
        return buildResponse(
          {
            error: `Impossible de charger le lot à l'index ${i}`,
            message: `Bubble a renvoyé une erreur en récupérant le lot lié à lots[${i}].`,
            bubbleResponse: lotResults[i].data,
          },
          lotResults[i].status
        );
      }
    }

    for (let i = 0; i < lotResults.length; i++) {
      if (!isRecord(lotResults[i].data)) {
        return buildResponse(
          {
            error: 'Le format du lot renvoyé par Bubble est inattendu',
            message:
              "Bubble n'a pas renvoyé un objet lot exploitable. Vérifiez que le workflow renvoie bien le JSON complet.",
            details: {
              index: i,
              lotId: lots[i],
              lotData: lotResults[i].data,
            },
          },
          502
        );
      }
    }

    const allLots = lotResults.map(result => result.data as Lot);

    if (allLots.length === 1) {
      return buildResponse(allLots[0], 200);
    }

    const mergedLot = mergeLots(allLots) as Lot;

    mergedLot.title = `merged (${allLots.length} lots)`;
    mergedLot.frequency = (allLots[0] as Lot).frequency ?? null;

    return buildResponse(mergedLot, 200);
  } catch (err) {
    if (err instanceof BubbleClientError) {
      return buildResponse(err.body, err.status);
    }

    console.error('API Merge Many - Erreur inattendue:', err);

    return buildResponse(
      {
        error: 'Erreur lors de la fusion des lots',
        message: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}
