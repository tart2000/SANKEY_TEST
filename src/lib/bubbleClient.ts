type BubbleCallArgs = {
  endpoint?: string;
  params?: Record<string, unknown>;
  method?: string;
};

export class BubbleClientError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type BubbleCallResult = {
  status: number;
  data: unknown;
};

export async function callBubble({
  endpoint,
  params = {},
  method = 'GET',
}: BubbleCallArgs): Promise<BubbleCallResult> {
  const apiKey = process.env.BUBBLE_API_KEY;

  if (!apiKey) {
    console.error('BUBBLE_API_KEY is not defined');
    throw new BubbleClientError(
      'Configuration error: BUBBLE_API_KEY not found',
      500,
      {
        error: 'Configuration error: BUBBLE_API_KEY not found',
        message: 'Please check your environment variables',
      }
    );
  }

  const normalizedParams: Record<string, unknown> = {
    ...(params || {}),
  };

  const isLive =
    normalizedParams.isLive === true || normalizedParams.isLive === 'true';

  let baseUrl = 'https://app.valoramix.com/';
  if (!isLive) {
    baseUrl += 'version-test/';
  }
  baseUrl += 'api/1.1/wf/';

  const paramsSansIsLive: Record<string, unknown> = { ...normalizedParams };
  delete paramsSansIsLive.isLive;

  const endpointNorm = (endpoint || '').replace(/^\//, '');
  let url = baseUrl + endpointNorm;

  const endpointHasQuery = endpointNorm.includes('?');
  if (
    method === 'GET' &&
    paramsSansIsLive &&
    Object.keys(paramsSansIsLive).length > 0 &&
    !endpointHasQuery
  ) {
    const searchParams = new URLSearchParams();
    Object.entries(paramsSansIsLive).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    url += '?' + searchParams.toString();
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  };

  if (
    method !== 'GET' &&
    paramsSansIsLive &&
    Object.keys(paramsSansIsLive).length > 0
  ) {
    fetchOptions.body = JSON.stringify(paramsSansIsLive);
  }

  console.log('API Bubble - URL:', url);
  console.log('API Bubble - Options:', fetchOptions);
  console.log('API Bubble - Body envoyé:', fetchOptions.body);

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      console.log('API Bubble - Réponse JSON:', data);
      return { status: response.status, data };
    } catch {
      console.log('API Bubble - Réponse non-JSON (probablement JS):', text);
      try {
        const jsData = new Function('return ' + text)() as unknown;
        console.log(
          'API Bubble - Réponse parsée et convertie en JSON:',
          jsData
        );
        return { status: response.status, data: jsData };
      } catch (parseError) {
        console.log('API Bubble - Erreur lors du parsing JS:', parseError);
        throw new BubbleClientError(
          'Impossible de parser la réponse de Bubble',
          500,
          {
            error: 'Impossible de parser la réponse de Bubble',
            status: response.status,
            raw: text,
          }
        );
      }
    }
  } catch (err) {
    console.log('API Bubble - Erreur fetch:', err);

    if (err instanceof Error && err.name === 'AbortError') {
      throw new BubbleClientError('Timeout de la requête vers Bubble', 504, {
        error: 'Timeout de la requête vers Bubble',
        message: 'La requête a pris plus de 30 secondes',
      });
    }

    throw new BubbleClientError('Erreur lors du fetch', 500, {
      error: 'Erreur lors du fetch',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export async function fetchBubbleLot({
  id,
  isLive,
}: {
  id: string;
  isLive: boolean;
}): Promise<Record<string, unknown>> {
  const { status, data } = await callBubble({
    endpoint: 'lot',
    params: { id, isLive },
    method: 'POST',
  });

  if (!isSuccessStatus(status)) {
    throw new BubbleClientError(
      'Impossible de récupérer le lot via Bubble',
      status,
      data
    );
  }

  if (!isRecord(data)) {
    throw new BubbleClientError(
      'Format de lot renvoyé par Bubble inattendu',
      502,
      {
        error: 'Lot invalide',
        details:
          'Bubble doit renvoyer un objet JSON représentant le lot complet.',
        bubbleResponse: data,
      }
    );
  }

  return data;
}
