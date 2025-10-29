export async function POST(request: Request) {
  try {
    const { endpoint, params, method = 'GET' } = await request.json();
    const apiKey = process.env.BUBBLE_API_KEY;

    if (!apiKey) {
      console.error('BUBBLE_API_KEY is not defined');
      return new Response(
        JSON.stringify({
          error: 'Configuration error: BUBBLE_API_KEY not found',
          message: 'Please check your environment variables',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy':
              "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
          },
        }
      );
    }

    // Gestion de l'environnement live/dev
    const isLive = params?.isLive === true || params?.isLive === 'true';
    let baseUrl = 'https://app.valoramix.com/';
    if (!isLive) {
      baseUrl += 'version-test/';
    }
    baseUrl += 'api/1.1/wf/';

    // On retire isLive des params envoyés à Bubble
    const paramsSansIsLive = { ...params };
    delete paramsSansIsLive.isLive;

    // Sécurise l'URL pour éviter les doubles slashs
    let url = baseUrl + (endpoint || '').replace(/^\//, '');

    // Pour les requêtes GET, ajouter les paramètres dans l'URL
    if (
      method === 'GET' &&
      paramsSansIsLive &&
      Object.keys(paramsSansIsLive).length > 0
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
      // Ajouter un timeout de 30 secondes
      signal: AbortSignal.timeout(30000), // 30 secondes
    };
    // Envoie le body pour les requêtes POST avec des paramètres
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

    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
      console.log('API Bubble - Réponse JSON:', data);
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Frame-Options': 'ALLOWALL',
          'Content-Security-Policy':
            "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
        },
      });
    } catch {
      console.log('API Bubble - Réponse non-JSON (probablement JS):', text);
      // Si ce n'est pas du JSON, c'est probablement du JavaScript de Bubble
      // On parse la réponse JavaScript et on la convertit en JSON propre
      try {
        // Utiliser Function pour évaluer la réponse JavaScript de manière sécurisée
        const jsData = new Function('return ' + text)();
        console.log(
          'API Bubble - Réponse parsée et convertie en JSON:',
          jsData
        );
        return new Response(JSON.stringify(jsData), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy':
              "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
          },
        });
      } catch (parseError) {
        console.log('API Bubble - Erreur lors du parsing JS:', parseError);
        return new Response(
          JSON.stringify({
            error: 'Impossible de parser la réponse de Bubble',
            status: response.status,
            raw: text,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'X-Frame-Options': 'ALLOWALL',
              'Content-Security-Policy':
                "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
            },
          }
        );
      }
    }
  } catch (err) {
    console.log('API Bubble - Erreur fetch:', err);

    // Gestion spécifique du timeout
    if (err instanceof Error && err.name === 'AbortError') {
      return new Response(
        JSON.stringify({
          error: 'Timeout de la requête vers Bubble',
          message: 'La requête a pris plus de 30 secondes',
        }),
        {
          status: 504,
          headers: {
            'Content-Type': 'application/json',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy':
              "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Erreur lors du fetch',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Frame-Options': 'ALLOWALL',
          'Content-Security-Policy':
            "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
        },
      }
    );
  }
}
