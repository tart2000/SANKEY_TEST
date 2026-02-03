import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type DimensionDefinition = {
  level: number;
  parent: string | null;
  children: string[];
  description: string;
  isPriority?: boolean;
};

export type DimensionHierarchy = Record<string, DimensionDefinition>;

let cachedHierarchy: DimensionHierarchy | null = null;
let cachedProcessingOrder: string[] | null = null;

const DIMENSION_FILE_PATH = path.join(
  process.cwd(),
  'public',
  'config',
  'dimensions.js'
);

function loadDimensionsFromFile() {
  if (cachedHierarchy && cachedProcessingOrder) {
    return;
  }

  const fileContent = fs.readFileSync(DIMENSION_FILE_PATH, 'utf-8');
  const context = {
    window: {} as Record<string, unknown>,
  };

  vm.runInNewContext(fileContent, context);

  const hierarchy = context.window.DIMENSION_HIERARCHY;
  const processingOrder = context.window.DIMENSION_PROCESSING_ORDER;

  if (!hierarchy || !processingOrder) {
    throw new Error(
      'dimensions.js doit définir DIMENSION_HIERARCHY et DIMENSION_PROCESSING_ORDER'
    );
  }

  cachedHierarchy = hierarchy as DimensionHierarchy;
  cachedProcessingOrder = processingOrder as string[];
}

export function getDimensionHierarchy(): DimensionHierarchy {
  loadDimensionsFromFile();
  return cachedHierarchy as DimensionHierarchy;
}

export function getDimensionProcessingOrder(): string[] {
  loadDimensionsFromFile();
  return cachedProcessingOrder as string[];
}
