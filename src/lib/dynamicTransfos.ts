export type DynamicTransfoInfo = {
  en_gb?: string;
  fr_fr?: string;
  bubble_id: string;
  step: string;
  version: number;
  inputs: Array<{ types: string }>;
  targets: {
    formats: string;
    types: string;
  };
};

export type DynamicTransfosInfoResponse = Record<string, DynamicTransfoInfo>;

export type DynamicRule = {
  inputTypeIds: string[];
  outputTypeId: string;
  outputFormatId: string;
};

export function buildDynamicRules(data: unknown): DynamicRule[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }

  const records = data as Record<string, unknown>;
  const rules: DynamicRule[] = [];

  for (const value of Object.values(records)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const info = value as Partial<DynamicTransfoInfo>;
    if (
      !info.targets ||
      typeof info.targets !== 'object' ||
      !info.targets.formats ||
      !info.targets.types ||
      !Array.isArray(info.inputs)
    ) {
      continue;
    }

    const inputTypeIds = info.inputs
      .map(input => input?.types)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (inputTypeIds.length === 0) continue;

    rules.push({
      inputTypeIds,
      outputTypeId: info.targets.types,
      outputFormatId: info.targets.formats,
    });
  }

  return rules;
}
