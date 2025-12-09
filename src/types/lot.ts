/**
 * Types pour le module Lot
 */

// Type pour un élément de dimension (peut être un objet avec pourcentage ou un nombre)
export type DimensionValue =
  | {
      pourcentage: number;
      color?: string;
      title?: string;
      en_gb?: string;
      [key: string]: unknown; // Permet d'avoir des dimensions enfants
    }
  | number;

// Type pour une dimension (objet avec des clés de valeurs)
export type Dimension = {
  title?: string;
  [key: string]: DimensionValue | string | undefined;
};

// Type pour un lot complet (structure arborescente)
export type Lot = {
  title?: string;
  total: number;
  frequency?: 'récurrent' | 'ponctuel';
  [dimension: string]: Dimension | string | number | undefined; // Permet d'avoir n'importe quelle dimension
};

// Type pour un élément de chemin de navigation
export type CheminSelectionItem = {
  dimension: string;
  valeur: string | null;
};

// Type pour le chemin de navigation complet
export type CheminSelection = CheminSelectionItem[];

// Type pour un segment de stackbar
export type StackbarSegment = {
  name: string;
  key: string;
  percent: number;
  color?: string;
};

// Type pour les paramètres d'URL
export type LotUrlParams = {
  lang: string;
  id: string;
  isLive: boolean;
  isEditable: boolean;
  width?: string;
};

// Type pour les options de frequency
export type FrequencyOption = {
  value: 'récurrent' | 'ponctuel';
  label: string;
  icon: string;
};

// Type pour les labels de dimensions
export type DimensionLabels = {
  [dimension: string]: {
    fr_fr?: string;
    en_gb?: string;
    [lang: string]: string | undefined;
  };
};

// Type pour les données de base d'une dimension
export type BaseDataItem = {
  bubble_id?: string;
  title?: string;
  en_gb?: string;
  color?: string;
  [key: string]: unknown;
};

export type BaseData = {
  [key: string]: BaseDataItem;
};

// Type pour les infos d'un header
export type HeaderInfo = {
  nodeParent: Lot | Dimension | null;
  dimension: string;
  valeur: string;
  nom: string;
  nomCle: string;
  itemObj: DimensionValue | null;
  pct: number;
  kg: number;
};

// Type pour les paramètres de la modal d'ajout
export type AddItemParams = {
  niveau: number;
  dimension: string;
  element: string;
  pourcentage: number;
  donneesBase: BaseDataItem;
};

// Type pour une ligne du tableau agrégé
export type AggregatedRow = {
  bubbleId: string | null;
  name: string;
  totalKg: number;
  totalPercentage: number;
  color?: string;
};
