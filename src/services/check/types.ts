export type Severity = 'critical' | 'warning' | 'info';

export type ValidationIssue = {
  path: string;
  expected: string;
  found: unknown;
  severity: Severity;
  suggestion?: string;
  context?: Record<string, unknown>;
};

export type DimensionDefinition = {
  level: number;
  parent: string | null;
  children: string[];
  description: string;
};

export type DimensionHierarchy = Record<string, DimensionDefinition>;

export type CheckContext = {
  dimensionHierarchy: DimensionHierarchy;
};

export type Validator = (
  lot: Record<string, unknown>,
  context: CheckContext
) => ValidationIssue[];
