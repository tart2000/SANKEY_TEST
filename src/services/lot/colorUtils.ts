/**
 * Utilitaires pour le calcul des couleurs des segments de stackbar
 * Utilise D3 si disponible (chargé via CDN), sinon utilise des couleurs de fallback
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Vérifie si un segment est spécial (inconnu, autre, etc.)
 */
export function isSpecialSegment(name: string): boolean {
  return ['inconnu', 'autre', 'autres compositions'].includes(
    name.toLowerCase()
  );
}

/**
 * Calcule la couleur d'un segment selon la dimension et l'index
 * Utilise D3 si disponible, sinon des couleurs de fallback
 */
export function getSegmentColor(
  dimension: string,
  index: number,
  totalSegments: number,
  itemColor?: string
): RGBColor {
  // Si l'item a déjà une couleur, l'utiliser
  if (itemColor) {
    return parseColor(itemColor);
  }

  // Calculer le facteur t pour l'interpolation (0 à 1)
  const t = totalSegments > 1 ? index / (totalSegments - 1) : 0.5;

  // Utiliser D3 si disponible (chargé via CDN)
  if (typeof window !== 'undefined' && (window as { d3?: unknown }).d3) {
    const d3 = (
      window as unknown as {
        d3: {
          color: (color: string) => { r: number; g: number; b: number } | null;
          interpolateYlGn: (t: number) => string;
          interpolatePlasma: (t: number) => string;
          interpolateCool: (t: number) => string;
          interpolateRainbow: (t: number) => string;
          interpolateOranges: (t: number) => string;
          interpolateBlues: (t: number) => string;
        };
      }
    ).d3;
    let colorString: string;

    if (dimension === 'format' || dimension === 'formats') {
      colorString = d3.interpolateYlGn(t);
    } else if (dimension === 'type' || dimension === 'types') {
      colorString = d3.interpolatePlasma(t);
    } else if (dimension === 'matiere' || dimension === 'matieres') {
      colorString = d3.interpolateCool(t);
    } else if (dimension === 'fibre' || dimension === 'fibres') {
      const tFibres = totalSegments > 1 ? 0.15 + 0.7 * t : 0.5;
      colorString = d3.interpolateRainbow(tFibres);
    } else if (dimension === 'qualite') {
      colorString = d3.interpolateOranges(t);
    } else if (dimension === 'proprete') {
      colorString = d3.interpolateBlues(t);
    } else {
      colorString = '#bbb';
    }

    const d3Color = d3.color(colorString);
    if (!d3Color) {
      // Fallback si d3.color retourne null
      return getFallbackColor(dimension, t);
    }
    return {
      r: Math.round(d3Color.r),
      g: Math.round(d3Color.g),
      b: Math.round(d3Color.b),
    };
  }

  // Fallback si D3 n'est pas disponible
  return getFallbackColor(dimension, t);
}

/**
 * Parse une couleur (hex, rgb, etc.) en RGB
 */
function parseColor(color: string): RGBColor {
  // Si c'est déjà au format rgb(...), extraire les valeurs
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return {
        r: parseInt(matches[0], 10),
        g: parseInt(matches[1], 10),
        b: parseInt(matches[2], 10),
      };
    }
  }

  // Si c'est hex (#rrggbb)
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // Fallback gris
  return { r: 187, g: 187, b: 187 };
}

/**
 * Couleurs de fallback si D3 n'est pas disponible
 */
function getFallbackColor(dimension: string, t: number): RGBColor {
  // Couleurs de base par dimension
  const colors: Record<string, RGBColor[]> = {
    formats: [
      { r: 255, g: 255, b: 204 },
      { r: 194, g: 230, b: 153 },
      { r: 120, g: 198, b: 121 },
      { r: 49, g: 163, b: 84 },
    ],
    types: [
      { r: 13, g: 8, b: 135 },
      { r: 75, g: 10, b: 161 },
      { r: 125, g: 3, b: 168 },
      { r: 168, g: 56, b: 149 },
      { r: 203, g: 102, b: 120 },
      { r: 229, g: 153, b: 93 },
      { r: 248, g: 201, b: 95 },
    ],
    matieres: [
      { r: 69, g: 117, b: 180 },
      { r: 116, g: 173, b: 209 },
      { r: 171, g: 217, b: 233 },
      { r: 224, g: 243, b: 248 },
    ],
    fibres: [
      { r: 110, g: 64, b: 170 },
      { r: 191, g: 129, b: 45 },
      { r: 56, g: 88, b: 141 },
      { r: 197, g: 90, b: 17 },
      { r: 89, g: 161, b: 79 },
      { r: 40, g: 112, b: 53 },
    ],
  };

  const dimensionKey = dimension.replace(/s$/, ''); // Enlever le 's' final
  const palette = colors[dimension] || colors[dimensionKey] || [];

  if (palette.length > 0) {
    const index = Math.floor(t * (palette.length - 1));
    return palette[index];
  }

  // Couleur grise par défaut
  return { r: 187, g: 187, b: 187 };
}

/**
 * Formate une couleur RGB en string CSS rgba
 */
export function formatRGBA(color: RGBColor, alpha: number = 1): string {
  return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

/**
 * Retourne les styles CSS pour un segment spécial (inconnu, autre)
 */
export function getSpecialSegmentStyles(): {
  background: string;
  border: string;
} {
  return {
    background:
      'repeating-linear-gradient(135deg, #f5f5f5, #f5f5f5 2px, #e0e0e0 2px, #e0e0e0 4px)',
    border: '1px solid #bbb',
  };
}
