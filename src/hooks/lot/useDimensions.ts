import { useState, useCallback, useRef } from 'react';
import type { DimensionLabels, BaseData, BaseDataItem } from '@/types/lot';

// Mapping entre les noms des dimensions et les endpoints API
function getEndpointForDimension(dimension: string): string {
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
  return mapping[dimension] || dimension;
}

export function useDimensions(isLive: boolean) {
  const [dimensionsLabels, setDimensionsLabels] =
    useState<DimensionLabels | null>(null);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [errorLabels, setErrorLabels] = useState<string | null>(null);

  // Cache pour les données de base par dimension
  const baseDataCache = useRef<Map<string, BaseData>>(new Map());
  const [loadingBaseData, setLoadingBaseData] = useState<Set<string>>(
    new Set()
  );
  const [errorBaseData, setErrorBaseData] = useState<Map<string, string>>(
    new Map()
  );

  // Charger les labels des dimensions
  const loadDimensionsLabels = useCallback(async () => {
    // Charger les dimensions à chaque appel pour avoir les dernières valeurs depuis l'API
    setLoadingLabels(true);
    setErrorLabels(null);

    try {
      const response = await fetch('/api/bubble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'dimensions',
          params: { isLive },
          method: 'GET',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      setDimensionsLabels(data as DimensionLabels);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorLabels(errorMessage);
      console.error('[Lot] Erreur lors du chargement des dimensions:', err);
    } finally {
      setLoadingLabels(false);
    }
  }, [isLive]);

  // Charger les données de base pour une dimension
  const loadBaseData = useCallback(
    async (dimension: string): Promise<BaseData | null> => {
      // Vérifier le cache
      if (baseDataCache.current.has(dimension)) {
        return baseDataCache.current.get(dimension) || null;
      }

      // Vérifier si déjà en cours de chargement
      if (loadingBaseData.has(dimension)) {
        // Attendre que le chargement se termine
        return new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (baseDataCache.current.has(dimension)) {
              clearInterval(checkInterval);
              resolve(baseDataCache.current.get(dimension) || null);
            } else if (!loadingBaseData.has(dimension)) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 100);
        });
      }

      setLoadingBaseData(prev => new Set(prev).add(dimension));
      setErrorBaseData(prev => {
        const newMap = new Map(prev);
        newMap.delete(dimension);
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
        baseDataCache.current.set(dimension, baseData);
        return baseData;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        setErrorBaseData(prev => new Map(prev).set(dimension, errorMessage));
        console.error(
          `Erreur lors du chargement des données pour ${dimension}:`,
          err
        );
        return null;
      } finally {
        setLoadingBaseData(prev => {
          const newSet = new Set(prev);
          newSet.delete(dimension);
          return newSet;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLive]
  );

  // Récupérer un élément complet depuis l'API
  const fetchItemComplete = useCallback(
    async (bubbleId: string): Promise<BaseDataItem | null> => {
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
    [isLive]
  );

  return {
    dimensionsLabels,
    loadingLabels,
    errorLabels,
    loadDimensionsLabels,
    loadBaseData,
    fetchItemComplete,
    isLoadingBaseData: (dimension: string) => loadingBaseData.has(dimension),
    getBaseDataError: (dimension: string) =>
      errorBaseData.get(dimension) || null,
  };
}
