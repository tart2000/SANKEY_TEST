import { useState, useCallback, useRef, useEffect } from 'react';
import type { DimensionLabels, BaseData, BaseDataItem } from '@/types/lot';

// Normalise une clé de dimension en retirant les accents et en mettant en minuscule
function normalizeDimensionKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les diacritiques (accents)
    .toLowerCase();
}

// Mapping entre les noms des dimensions et les endpoints API
function getEndpointForDimension(dimension: string): string {
  // Normaliser la dimension pour gérer les accents et variations
  const normalized = normalizeDimensionKey(dimension);

  const mapping: Record<string, string> = {
    formats: 'formats',
    matieres: 'matieres',
    fibres: 'fibres',
    types: 'types',
    couleurs: 'couleurs',
    qualite: 'qualites', // Le code utilise 'qualite' mais l'API attend 'qualites'
    proprete: 'propretes', // Le code utilise 'proprete' mais l'API attend 'propretes'
    perturbateurs: 'perturbateurs',
  };

  // Chercher d'abord avec la dimension normalisée
  if (normalized in mapping) {
    return mapping[normalized];
  }

  // Si pas trouvé, chercher avec la dimension originale
  return mapping[dimension] || dimension;
}

export function useDimensions() {
  const [dimensionsLabels, setDimensionsLabels] =
    useState<DimensionLabels | null>(null);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [errorLabels, setErrorLabels] = useState<string | null>(null);

  // Ref pour logger la valeur actuelle sans dépendre du state dans useCallback
  const dimensionsLabelsRef = useRef<DimensionLabels | null>(null);

  // Cache pour les données de base par dimension
  const baseDataCache = useRef<Map<string, BaseData>>(new Map());
  const [loadingBaseData, setLoadingBaseData] = useState<Set<string>>(
    new Set()
  );
  const [errorBaseData, setErrorBaseData] = useState<Map<string, string>>(
    new Map()
  );

  // Mettre à jour la ref quand dimensionsLabels change
  useEffect(() => {
    dimensionsLabelsRef.current = dimensionsLabels;
  }, [dimensionsLabels]);

  // Charger les labels des dimensions
  const loadDimensionsLabels = useCallback(async (isLive: boolean) => {
    console.log('[useDimensions] loadDimensionsLabels appelé', {
      isLive,
      dimensionsLabelsActuelles: dimensionsLabelsRef.current,
      timestamp: new Date().toISOString(),
    });

    // Charger les dimensions à chaque appel pour avoir les dernières valeurs depuis l'API
    setLoadingLabels(true);
    setErrorLabels(null);

    try {
      const requestBody = {
        endpoint: 'dimensions',
        params: { isLive },
        method: 'GET',
      };

      console.log('[useDimensions] Appel API /api/bubble', {
        body: requestBody,
        isLive,
      });

      const response = await fetch('/api/bubble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(requestBody),
      });

      console.log('[useDimensions] Réponse API reçue', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      console.log("[useDimensions] Données dimensions reçues de l'API", {
        data,
        keys: Object.keys(data),
        sample: Object.keys(data)
          .slice(0, 3)
          .reduce(
            (acc, key) => {
              acc[key] = data[key];
              return acc;
            },
            {} as Record<string, unknown>
          ),
      });

      console.log('[useDimensions] Mise à jour du state dimensionsLabels', {
        ancien: dimensionsLabelsRef.current,
        nouveau: data,
      });

      setDimensionsLabels(data as DimensionLabels);
      dimensionsLabelsRef.current = data as DimensionLabels;

      console.log('[useDimensions] State dimensionsLabels mis à jour', {
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorLabels(errorMessage);
      console.error(
        '[useDimensions] Erreur lors du chargement des dimensions:',
        {
          error: err,
          message: errorMessage,
          isLive,
        }
      );
    } finally {
      setLoadingLabels(false);
      console.log('[useDimensions] loadDimensionsLabels terminé', {
        isLive,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  // Charger les données de base pour une dimension
  const loadBaseData = useCallback(
    async (dimension: string, isLive: boolean): Promise<BaseData | null> => {
      // Créer une clé composite pour le cache (dimension + isLive)
      const cacheKey = `${dimension}_${isLive ? 'live' : 'test'}`;

      // Vérifier le cache
      if (baseDataCache.current.has(cacheKey)) {
        return baseDataCache.current.get(cacheKey) || null;
      }

      // Vérifier si déjà en cours de chargement
      if (loadingBaseData.has(cacheKey)) {
        // Attendre que le chargement se termine
        return new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (baseDataCache.current.has(cacheKey)) {
              clearInterval(checkInterval);
              resolve(baseDataCache.current.get(cacheKey) || null);
            } else if (!loadingBaseData.has(cacheKey)) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 100);
        });
      }

      setLoadingBaseData(prev => new Set(prev).add(cacheKey));
      setErrorBaseData(prev => {
        const newMap = new Map(prev);
        newMap.delete(cacheKey);
        return newMap;
      });

      try {
        const endpoint = getEndpointForDimension(dimension);
        const response = await fetch('/api/bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint,
            params: { isLive },
            method: 'GET',
          }),
        });

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();
        const baseData: BaseData = data as BaseData;
        baseDataCache.current.set(cacheKey, baseData);
        return baseData;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        setErrorBaseData(prev => new Map(prev).set(cacheKey, errorMessage));
        console.error(
          `Erreur lors du chargement des données pour ${dimension}:`,
          err
        );
        return null;
      } finally {
        setLoadingBaseData(prev => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
      }
    },
    [loadingBaseData]
  );

  // Récupérer un élément complet depuis l'API
  const fetchItemComplete = useCallback(
    async (bubbleId: string, isLive: boolean): Promise<BaseDataItem | null> => {
      try {
        const response = await fetch('/api/bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'item',
            method: 'POST',
            params: {
              id: bubbleId,
              isLive,
            },
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data as BaseDataItem;
      } catch (error) {
        console.error(
          "Erreur lors de la récupération de l'élément complet:",
          error
        );
        return null;
      }
    },
    []
  );

  // Récupérer un élément "small" (métadonnées seules, sans enfants) depuis l'API
  const fetchItemSmall = useCallback(
    async (bubbleId: string, isLive: boolean): Promise<BaseDataItem | null> => {
      try {
        const response = await fetch('/api/bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'item_small',
            method: 'GET',
            params: {
              id: bubbleId,
              isLive,
            },
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data as BaseDataItem;
      } catch (error) {
        console.error(
          "Erreur lors de la récupération de l'élément small:",
          error
        );
        return null;
      }
    },
    []
  );

  return {
    dimensionsLabels,
    loadingLabels,
    errorLabels,
    loadDimensionsLabels,
    loadBaseData,
    fetchItemComplete,
    fetchItemSmall,
    isLoadingBaseData: (dimension: string) => loadingBaseData.has(dimension),
    getBaseDataError: (dimension: string) =>
      errorBaseData.get(dimension) || null,
  };
}
