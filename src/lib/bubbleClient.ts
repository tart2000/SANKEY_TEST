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

function logBubble(
  stage: 'req' | 'ok' | 'err',
  endpoint: string,
  method: string,
  isLive: boolean,
  extra?: string
): void {
  const env = isLive ? 'live' : 'test';
  const msg = `[bubble:${stage}] ${method} ${endpoint} (${env})${extra ? ' ' + extra : ''}`;
  if (stage === 'err') console.error(msg);
  else console.log(msg);
}

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

  logBubble('req', endpointNorm, method, isLive);

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      logBubble(
        'ok',
        endpointNorm,
        method,
        isLive,
        `status=${response.status}`
      );
      return { status: response.status, data };
    } catch {
      try {
        const jsData = new Function('return ' + text)() as unknown;
        logBubble(
          'ok',
          endpointNorm,
          method,
          isLive,
          `status=${response.status} (non-json parsed)`
        );
        return { status: response.status, data: jsData };
      } catch {
        const preview = text.slice(0, 200);
        logBubble(
          'err',
          endpointNorm,
          method,
          isLive,
          `parse_failed status=${response.status} preview=${JSON.stringify(preview)}`
        );
        throw new BubbleClientError(
          'Impossible de parser la réponse de Bubble',
          500,
          {
            error: 'Impossible de parser la réponse de Bubble',
            status: response.status,
            preview,
          }
        );
      }
    }
  } catch (err) {
    if (err instanceof BubbleClientError) {
      throw err;
    }

    if (err instanceof Error && err.name === 'AbortError') {
      logBubble('err', endpointNorm, method, isLive, 'timeout');
      throw new BubbleClientError('Timeout de la requête vers Bubble', 504, {
        error: 'Timeout de la requête vers Bubble',
        message: 'La requête a pris plus de 30 secondes',
      });
    }

    const errMsg =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    logBubble('err', endpointNorm, method, isLive, errMsg);

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

export async function fetchCdc({
  id,
  isLive,
}: {
  id: string;
  isLive: boolean;
}): Promise<Record<string, unknown>> {
  const { status, data } = await callBubble({
    endpoint: 'cdc',
    params: { id, isLive },
    method: 'GET',
  });

  if (!isSuccessStatus(status)) {
    throw new BubbleClientError(
      'Impossible de récupérer le CDC via Bubble',
      status,
      data
    );
  }

  if (!isRecord(data)) {
    throw new BubbleClientError(
      'Format de CDC renvoyé par Bubble inattendu',
      502,
      {
        error: 'CDC invalide',
        details:
          'Bubble doit renvoyer un objet JSON représentant le CDC complet.',
        bubbleResponse: data,
      }
    );
  }

  return data;
}

export async function fetchTransfosInfo({
  isLive,
}: {
  isLive: boolean;
}): Promise<Record<string, unknown>> {
  const { status, data } = await callBubble({
    endpoint: 'transfos_info',
    params: { isLive },
    method: 'GET',
  });

  if (!isSuccessStatus(status)) {
    throw new BubbleClientError(
      'Impossible de récupérer les informations de transformations dynamiques via Bubble',
      status,
      data
    );
  }

  if (!isRecord(data)) {
    throw new BubbleClientError(
      'Format de transfos_info renvoyé par Bubble inattendu',
      502,
      {
        error: 'transfos_info invalide',
        details:
          'Bubble doit renvoyer un objet JSON (clé → objet) décrivant les transformations dynamiques.',
        bubbleResponse: data,
      }
    );
  }

  return data;
}
