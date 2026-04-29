import type {
  CheminSelection,
  Dimension,
  DimensionValue,
  Lot,
} from '@/types/lot';
import { getPercent, setPercent } from './lotUtils';
import { getNodeAtPath } from './dimensionUtils';

/**
 * Lit le pourcentage du nœud désigné par chemin[niveau] dans le lot.
 * Retourne 0 si introuvable.
 */
function getPctAt(lot: Lot, chemin: CheminSelection, niveau: number): number {
  if (niveau < 0 || niveau >= chemin.length) return 0;

  const parent = getNodeAtPath(lot, chemin.slice(0, niveau));
  if (!parent || typeof parent !== 'object') return 0;

  const dim = chemin[niveau].dimension;
  const val = chemin[niveau].valeur;
  if (!dim || !val) return 0;

  const dimObj = (parent as Record<string, unknown>)[dim];
  if (!dimObj || typeof dimObj !== 'object' || Array.isArray(dimObj)) return 0;

  const node = (dimObj as Record<string, unknown>)[val];
  if (node === undefined) return 0;
  if (typeof node === 'number') return node;
  if (typeof node === 'object' && node !== null && 'pourcentage' in node) {
    return (node as { pourcentage: number }).pourcentage;
  }
  return 0;
}

/**
 * Calcule, pour un chemin donné et un total `G`, les masses des parents à chaque niveau.
 * S[0] = G ; S[i] = S[i-1] × pct(chemin[i-1]) / 100.
 *
 * Doit être appelé sur le lot AVANT toute modification (insertion ou changement de total).
 */
export function calculerMassesParents(
  lot: Lot,
  chemin: CheminSelection,
  modalNiveau: number,
  G: number
): number[] {
  const S = new Array<number>(modalNiveau + 1);
  S[0] = G;
  for (let i = 1; i <= modalNiveau; i++) {
    const pct = getPctAt(lot, chemin, i - 1);
    S[i] = (S[i - 1] * pct) / 100;
  }
  return S;
}

/**
 * Après l'insertion ou la suppression locale d'un nœud, recalcule les pourcentages
 * des frères à chaque niveau ancestral pour conserver les masses absolues hors-chemin
 * et faire absorber +delta (ou -delta pour une suppression) uniquement par la branche
 * on-path.
 *
 * `niveauCible` est l'index du nœud où la mutation a eu lieu :
 *   - pour un AJOUT, c'est `modalNiveau` (la dimension où on insère),
 *   - pour une SUPPRESSION, c'est `niveau - 1` (le parent direct du nœud supprimé).
 *
 * Pour chaque niveau i de niveauCible-1 à 0 :
 *   - branche = chemin[i].valeur
 *   - S_avant = S[i] (masse du parent du niveau i avant mutation)
 *   - S_apres = S_avant + delta
 *   - pour la branche : nouveau pct = (S_avant × ancienPct/100 + delta) / S_apres × 100
 *   - pour chaque frère hors-chemin : nouveau pct = ancienPct × S_avant / S_apres
 *
 * Ces formules garantissent (pour delta de signe quelconque) :
 *   - somme des nouveaux pcts = 100 (à l'epsilon flottant près)
 *   - masse du frère hors-chemin = S_apres × nouveauPct/100 = S_avant × ancienPct/100
 *     (donc inchangée en kg, ce qui est le comportement attendu)
 *   - masse de la branche = S_apres × nouveauPct/100 = S_avant × ancienPct/100 + delta
 */
export function propagerDeltaKgVersAncetres(
  lot: Lot,
  chemin: CheminSelection,
  niveauCible: number,
  S: number[],
  delta: number
): void {
  if (delta === 0 || !Number.isFinite(delta)) return;

  for (let i = niveauCible - 1; i >= 0; i--) {
    const branche = chemin[i]?.valeur;
    const dim = chemin[i]?.dimension;
    if (!branche || !dim) continue;

    const parent = getNodeAtPath(lot, chemin.slice(0, i));
    if (!parent || typeof parent !== 'object') continue;

    const dimObj = (parent as Record<string, unknown>)[dim];
    if (!dimObj || typeof dimObj !== 'object' || Array.isArray(dimObj)) {
      continue;
    }
    const liste = dimObj as Dimension;

    const S_avant = S[i];
    const S_apres = S_avant + delta;
    if (!Number.isFinite(S_avant) || S_apres <= 0) continue;

    const keys = Object.keys(liste).filter(k => k !== 'title');
    for (const k of keys) {
      const val = liste[k];
      if (val === undefined || typeof val === 'string') continue;
      const ancienPct = getPercent(val as DimensionValue);

      let nouveauPct: number;
      if (k === branche) {
        const masseBrancheAvant = (S_avant * ancienPct) / 100;
        nouveauPct = ((masseBrancheAvant + delta) / S_apres) * 100;
      } else {
        nouveauPct = (ancienPct * S_avant) / S_apres;
      }

      liste[k] = setPercent(val as DimensionValue, nouveauPct);
    }
  }
}

/**
 * Alias historique pour les ajouts (delta > 0). Identique à
 * propagerDeltaKgVersAncetres, conservé pour ne pas casser l'API existante.
 */
export const propagerAjoutKgVersAncetres = propagerDeltaKgVersAncetres;
