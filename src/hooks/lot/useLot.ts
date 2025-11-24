import { useState, useCallback, useRef, useEffect } from 'react';
import type { Lot } from '@/types/lot';
import { deepCopy } from '@/services/lot/lotUtils';

export function useLot(initialLot: Lot | null) {
  const [lot, setLot] = useState<Lot | null>(initialLot);
  const [isModified, setIsModified] = useState(false);
  const initialLotRef = useRef<Lot | null>(initialLot);

  // Mettre à jour la référence initiale quand le lot change depuis l'extérieur
  // On compare le contenu JSON pour éviter de réinitialiser isModified si c'est juste une nouvelle référence
  useEffect(() => {
    const currentJson = initialLotRef.current
      ? JSON.stringify(initialLotRef.current)
      : null;
    const newJson = initialLot ? JSON.stringify(initialLot) : null;

    // Seulement mettre à jour si le contenu a vraiment changé
    if (currentJson !== newJson) {
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

  // Fonction pour set le lot ET marquer comme modifié (pour les modifications utilisateur)
  const setLotAndMarkModified = useCallback((newLot: Lot | null) => {
    if (newLot) {
      setLot(newLot);
      setIsModified(true);
    }
  }, []);

  // Fonction pour marquer le lot comme sauvegardé (remet isModified à false)
  const markAsSaved = useCallback(() => {
    if (lot) {
      initialLotRef.current = deepCopy(lot);
      setIsModified(false);
    }
  }, [lot]);

  return {
    lot,
    isModified,
    updateLot,
    resetLot,
    setLot: setLotAndMarkModified, // Exporter la fonction qui marque comme modifié
    markAsSaved, // Exporter la fonction pour marquer comme sauvegardé
    setIsModified,
  };
}
