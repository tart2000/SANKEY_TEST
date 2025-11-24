import { useState, useCallback, useRef, useEffect } from 'react';
import type { Lot } from '@/types/lot';
import { deepCopy } from '@/services/lot/lotUtils';

export function useLot(initialLot: Lot | null) {
  const [lot, setLot] = useState<Lot | null>(initialLot);
  const [isModified, setIsModified] = useState(false);
  const initialLotRef = useRef<Lot | null>(initialLot);

  // Mettre à jour la référence initiale quand le lot change depuis l'extérieur
  useEffect(() => {
    if (initialLot !== initialLotRef.current) {
      initialLotRef.current = initialLot ? deepCopy(initialLot) : null;
      setLot(initialLot ? deepCopy(initialLot) : null);
      setIsModified(false);
    }
  }, [initialLot]);

  const updateLot = useCallback((updater: (lot: Lot) => Lot) => {
    setLot(prev => {
      if (!prev) return prev;
      const updated = updater(deepCopy(prev));
      setIsModified(true);
      return updated;
    });
  }, []);

  const resetLot = useCallback(() => {
    if (initialLotRef.current) {
      setLot(deepCopy(initialLotRef.current));
      setIsModified(false);
    }
  }, []);

  const setLotDirect = useCallback((newLot: Lot | null) => {
    setLot(newLot);
    initialLotRef.current = newLot ? deepCopy(newLot) : null;
    setIsModified(false);
  }, []);

  return {
    lot,
    isModified,
    updateLot,
    resetLot,
    setLot: setLotDirect,
    setIsModified,
  };
}
