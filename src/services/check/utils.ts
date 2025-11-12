export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value);

export const toPath = (segments: Array<string | number>) =>
  segments
    .map(segment =>
      typeof segment === 'number'
        ? `[${segment}]`
        : segment.replace(/\./g, '\\.')
    )
    .join('.');
