import { useState, useRef, useEffect } from 'react';
import type {
  Lot,
  Dimension,
  DimensionValue,
  CheminSelection,
  DimensionLabels,
} from '@/types/lot';
import { getDimensionLabel } from '@/services/lot/dimensionUtils';
import { deepCopy } from '@/services/lot/lotUtils';

interface StackbarHeaderProps {
  niveau: number;
  nom: string;
  nomCle: string;
  itemObj: DimensionValue | null;
  pct: number;
  kg: number;
  lot: Lot;
  cheminSelection: CheminSelection;
  availableDimensions: string[];
  dimensionsLabels: DimensionLabels | null;
  lang: string;
  isEditable: boolean;
  frequency?: 'récurrent' | 'ponctuel';
  onNavigateSibling: (niveau: number, direction: -1 | 1) => void;
  onDimensionChange: (dimension: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onClose: () => void;
  onFrequencyChange: (frequency: 'récurrent' | 'ponctuel') => void;
  onUpdateLot: (updater: (lot: Lot) => Lot) => void;
  onLotChange: (lot: Lot) => void;
}

const FREQUENCY_OPTIONS = {
  récurrent: {
    value: 'récurrent' as const,
    label: 'Récurrent',
    icon: 'arrow-clockwise',
  },
  ponctuel: {
    value: 'ponctuel' as const,
    label: 'Ponctuel',
    icon: 'map-pin-simple-area',
  },
};

export function StackbarHeader({
  niveau,
  nom,
  nomCle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemObj: _itemObj,
  pct,
  kg,
  lot,
  cheminSelection,
  availableDimensions,
  dimensionsLabels,
  lang,
  isEditable,
  frequency,
  onNavigateSibling,
  onDimensionChange,
  onAdd,
  onDelete,
  onClose,
  onFrequencyChange,
  onUpdateLot,
  onLotChange,
}: StackbarHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editedName, setEditedName] = useState(nom);
  const [editedWeight, setEditedWeight] = useState(kg);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const frequencyDropdownRef = useRef<HTMLDivElement>(null);

  // Mettre à jour les valeurs quand les props changent
  useEffect(() => {
    setEditedName(nom);
  }, [nom]);

  useEffect(() => {
    setEditedWeight(kg);
  }, [kg]);

  // Focus sur l'input quand on entre en mode édition
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingWeight && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [isEditingWeight]);

  // Fermer le dropdown frequency si on clique ailleurs
  useEffect(() => {
    if (!showFrequencyDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        frequencyDropdownRef.current &&
        !frequencyDropdownRef.current.contains(e.target as Node)
      ) {
        setShowFrequencyDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showFrequencyDropdown]);

  const handleSaveName = () => {
    if (!isEditable) return;

    const newName = editedName.trim();
    if (newName && newName !== nom) {
      if (niveau === 0) {
        // Modifier le titre du lot
        onUpdateLot(lot => ({ ...lot, title: newName }));
        onLotChange({ ...lot, title: newName });
      } else {
        // Renommage d'un segment à un niveau > 0
        onUpdateLot(lot => {
          const newLot = deepCopy(lot);
          let nodeParent: Lot | Dimension = newLot;

          // Naviguer jusqu'au parent
          for (let i = 0; i < niveau - 1; i++) {
            const { dimension, valeur } = cheminSelection[i];
            if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
              return newLot;
            }
            const nodeObj = nodeParent as Record<string, unknown>;
            if (!(dimension in nodeObj)) {
              return newLot;
            }
            const dimValue = nodeObj[dimension];
            if (
              typeof dimValue !== 'object' ||
              dimValue === null ||
              Array.isArray(dimValue)
            ) {
              return newLot;
            }
            const dimObj = dimValue as Record<string, unknown>;
            if (!(valeur in dimObj)) {
              return newLot;
            }
            nodeParent = dimObj[valeur] as Lot | Dimension;
          }

          const dim = cheminSelection[niveau - 1]?.dimension;
          const val = cheminSelection[niveau - 1]?.valeur;

          // Si on est en en_gb et que l'objet a une traduction, on modifie seulement en_gb
          if (
            lang === 'en_gb' &&
            nodeParent &&
            dim &&
            typeof nodeParent === 'object' &&
            dim in nodeParent
          ) {
            const dimValue = (nodeParent as Record<string, unknown>)[dim];
            if (
              typeof dimValue === 'object' &&
              dimValue !== null &&
              !Array.isArray(dimValue) &&
              nomCle in dimValue
            ) {
              const dimObj = dimValue as Record<string, unknown>;
              const item = dimObj[nomCle];
              if (
                typeof item === 'object' &&
                item !== null &&
                'en_gb' in item
              ) {
                (item as { en_gb?: string }).en_gb = newName;
              }
            }
          } else {
            // Sinon, on renomme la clé
            if (
              nodeParent &&
              dim &&
              val &&
              typeof nodeParent === 'object' &&
              dim in nodeParent
            ) {
              const dimValue = (nodeParent as Record<string, unknown>)[dim];
              if (
                typeof dimValue === 'object' &&
                dimValue !== null &&
                !Array.isArray(dimValue)
              ) {
                const dimObj = dimValue as Record<string, unknown>;
                if (nomCle in dimObj && !(newName in dimObj)) {
                  const entries = Object.entries(dimObj);
                  const idx = entries.findIndex(([k]) => k === nomCle);
                  if (idx !== -1) {
                    const newEntries = [
                      ...entries.slice(0, idx),
                      [newName, dimObj[nomCle]],
                      ...entries.slice(idx + 1),
                    ];
                    const newObj: Record<string, unknown> = {};
                    newEntries.forEach(([k, v]) => {
                      newObj[k as string] = v;
                    });
                    (nodeParent as Record<string, unknown>)[dim] = newObj;
                  }
                }
              }
            }
          }

          onLotChange(newLot);
          return newLot;
        });
      }
    }
    setIsEditingName(false);
  };

  const handleSaveWeight = () => {
    if (!isEditable || niveau !== 0) return;

    const newWeight = parseFloat(editedWeight.toString());
    if (!isNaN(newWeight) && newWeight >= 0 && newWeight !== kg) {
      onUpdateLot(lot => ({ ...lot, total: newWeight }));
      onLotChange({ ...lot, total: newWeight });
    }
    setIsEditingWeight(false);
  };

  const currentDimension = cheminSelection[niveau]?.dimension;
  const currentFrequency = frequency || 'récurrent';
  const frequencyIcon =
    FREQUENCY_OPTIONS[currentFrequency]?.icon || 'arrow-clockwise';

  // Calculer le nombre de siblings pour masquer les flèches si un seul élément
  const hasSiblings = (() => {
    if (niveau === 0) return false; // Pas de flèches au niveau 0
    if (!cheminSelection[niveau - 1]?.dimension) return false;

    // Récupérer le nœud parent
    let nodeParent: Lot | Dimension | null = lot;
    for (let i = 0; i < niveau - 1; i++) {
      const { dimension, valeur } = cheminSelection[i];
      if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
        return false;
      }
      const nodeObj = nodeParent as Record<string, unknown>;
      if (!(dimension in nodeObj)) {
        return false;
      }
      const dimValue = nodeObj[dimension];
      if (
        typeof dimValue !== 'object' ||
        dimValue === null ||
        Array.isArray(dimValue)
      ) {
        return false;
      }
      const dimObj = dimValue as Record<string, unknown>;
      if (!(valeur in dimObj)) {
        return false;
      }
      const value = dimObj[valeur];
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
      }
      nodeParent = value as Lot | Dimension;
    }

    // Récupérer les siblings
    const parentDimension = cheminSelection[niveau - 1].dimension;
    if (!nodeParent || !parentDimension) return false;

    const nodeObj = nodeParent as Record<string, unknown>;
    if (!(parentDimension in nodeObj)) return false;

    const dimValue = nodeObj[parentDimension];
    if (
      typeof dimValue !== 'object' ||
      dimValue === null ||
      Array.isArray(dimValue)
    ) {
      return false;
    }

    const siblings = Object.keys(dimValue).filter(k => k !== 'title');
    return siblings.length > 1; // Afficher les flèches seulement s'il y a plus d'un sibling
  })();

  return (
    <div className="font-bold mb-4 flex items-center justify-between">
      <div className="flex items-center justify-between w-full">
        {/* Groupe gauche : Navigation, titre, %, kg, frequency */}
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white shadow-sm items-stretch h-10">
          {niveau > 0 && hasSiblings && (
            <>
              <button
                className="px-3 h-full hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center justify-center"
                aria-label="Précédent"
                onClick={() => onNavigateSibling(niveau - 1, -1)}
              >
                <i className="ph ph-caret-left w-4 h-4"></i>
              </button>
              <button
                className="border-l border-gray-300 px-3 h-full hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center justify-center"
                aria-label="Suivant"
                onClick={() => onNavigateSibling(niveau - 1, 1)}
              >
                <i className="ph ph-caret-right w-4 h-4"></i>
              </button>
            </>
          )}

          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSaveName();
                } else if (e.key === 'Escape') {
                  setEditedName(nom);
                  setIsEditingName(false);
                }
              }}
              className={`${niveau > 0 ? 'border-l border-gray-300' : ''} px-4 h-full font-bold text-base flex items-center outline-none`}
              style={{ width: '8rem', background: 'white', textAlign: 'left' }}
            />
          ) : (
            <span
              className={`${niveau > 0 ? 'border-l border-gray-300' : ''} px-4 h-full font-bold text-base flex items-center cursor-pointer`}
              onClick={() => {
                if (isEditable) setIsEditingName(true);
              }}
              tabIndex={0}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && isEditable) {
                  e.preventDefault();
                  setIsEditingName(true);
                }
              }}
            >
              {nom}
            </span>
          )}

          <span className="border-l border-gray-300 px-3 h-full text-sm flex items-center">
            {pct.toFixed(1)}%
          </span>

          {niveau === 0 ? (
            isEditingWeight ? (
              <input
                ref={weightInputRef}
                type="number"
                value={editedWeight}
                onChange={e => setEditedWeight(parseFloat(e.target.value) || 0)}
                onBlur={handleSaveWeight}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSaveWeight();
                  } else if (e.key === 'Escape') {
                    setEditedWeight(kg);
                    setIsEditingWeight(false);
                  }
                }}
                step="0.1"
                min="0"
                className="border-l border-gray-300 px-3 h-full text-sm flex items-center outline-none"
                style={{
                  width: '5rem',
                  background: 'white',
                  textAlign: 'right',
                }}
              />
            ) : (
              <span
                className="border-l border-gray-300 px-3 h-full text-sm flex items-center cursor-pointer"
                onClick={() => {
                  if (isEditable) setIsEditingWeight(true);
                }}
                tabIndex={0}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && isEditable) {
                    e.preventDefault();
                    setIsEditingWeight(true);
                  }
                }}
              >
                {kg ? `${kg.toFixed(1)} kg` : ''}
              </span>
            )
          ) : (
            <span className="border-l border-gray-300 px-3 h-full text-sm flex items-center">
              {kg ? `${kg.toFixed(1)} kg` : ''}
            </span>
          )}

          {niveau === 0 && (
            <div className="relative" ref={frequencyDropdownRef}>
              <button
                className="border-l border-gray-300 px-3 h-full hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center justify-center"
                aria-label="Actualiser"
                onClick={e => {
                  if (isEditable) {
                    e.stopPropagation();
                    setShowFrequencyDropdown(!showFrequencyDropdown);
                  }
                }}
              >
                <i className={`ph ph-${frequencyIcon} w-4 h-4`}></i>
              </button>

              {showFrequencyDropdown && (
                <div
                  className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] max-w-[160px]"
                  style={{
                    top: '100%',
                    right: '0',
                    marginTop: '5px',
                  }}
                >
                  <div role="menu" aria-orientation="vertical" className="py-1">
                    {Object.values(FREQUENCY_OPTIONS).map(option => {
                      const isSelected = currentFrequency === option.value;
                      return (
                        <button
                          key={option.value}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center ${
                            isSelected
                              ? 'text-blue-600 font-semibold'
                              : 'text-gray-700'
                          }`}
                          role="menuitem"
                          onClick={e => {
                            e.stopPropagation();
                            onFrequencyChange(option.value);
                            setShowFrequencyDropdown(false);
                          }}
                        >
                          <i
                            className={`ph ph-${option.icon} mr-2 w-4 h-4 ${
                              isSelected ? 'text-blue-600' : ''
                            }`}
                          ></i>
                          {option.label}
                          {isSelected && (
                            <i className="ph ph-check ml-auto w-4 h-4 text-blue-600"></i>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Groupe centre : Button group dimensions */}
        <div className="flex-1 flex justify-center items-center">
          {availableDimensions.length > 0 && (
            <div className="inline-flex rounded-lg border border-blue-200 bg-white shadow items-center h-10 overflow-hidden">
              {availableDimensions.map((dim, idx) => {
                const isSelected = dim === currentDimension;
                return (
                  <button
                    key={dim}
                    className={`h-10 min-w-[90px] px-4 text-base font-semibold focus:outline-none ${
                      isSelected
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                    } ${idx > 0 ? 'border-l border-gray-200' : ''}`}
                    style={{ borderRadius: 0 }}
                    onClick={() => onDimensionChange(dim)}
                  >
                    {getDimensionLabel(dim, dimensionsLabels, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Groupe droite : Boutons actions */}
        {isEditable && (
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white shadow-sm items-center h-10">
            {availableDimensions.length > 0 && (
              <button
                className="h-full px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 rounded-l-lg border-r border-gray-300"
                aria-label="Ajouter"
                onClick={onAdd}
              >
                <i className="ph ph-plus w-4 h-4"></i>
              </button>
            )}
            {niveau > 0 && (
              <>
                <button
                  className={`h-full px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 border-r border-gray-300 ${
                    availableDimensions.length === 0 ? 'rounded-l-lg' : ''
                  }`}
                  aria-label="Supprimer"
                  onClick={onDelete}
                >
                  <i className="ph ph-trash w-4 h-4"></i>
                </button>
                <button
                  className="h-full px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 rounded-r-lg"
                  aria-label="Fermer"
                  onClick={onClose}
                >
                  <i className="ph ph-x w-4 h-4"></i>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
