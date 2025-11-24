import { useState, useCallback } from 'react';
import type { Lot } from '@/types/lot';

export function useLotAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLot = useCallback(
    async (id: string, isLive: boolean): Promise<Lot | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'lot',
            params: {
              id,
              isLive,
            },
            method: 'POST',
          }),
        });

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();
        return data as Lot;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        setError(errorMessage);
        console.error('Erreur lors du chargement du lot:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const saveLot = useCallback(
    async (id: string, lot: Lot, isLive: boolean): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'save',
            params: {
              lot_id: id,
              value: JSON.stringify(lot),
              isLive,
            },
            method: 'POST',
          }),
        });

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        setError(errorMessage);
        console.error('Erreur lors de la sauvegarde du lot:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    fetchLot,
    saveLot,
  };
}
