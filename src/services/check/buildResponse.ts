import type { ValidationIssue } from './types';

const MAX_PER_BUCKET = 9;

const formatMessage = (crit: number, warn: number, info: number): string => {
  if (crit > 0) {
    return `${crit} anomalie(s) critique(s), corriger avant diffusion`;
  }

  if (warn > 0) {
    return `${warn} warning(s), vérifier la cohérence`;
  }

  if (info > 0) {
    return `Lot valide avec ${info} remarque(s) mineure(s)`;
  }

  return 'Lot valide';
};

export type CheckResult = {
  code: string;
  message: string;
  details: ValidationIssue[];
};

export const buildCheckResponse = (issues: ValidationIssue[]): CheckResult => {
  const counts = {
    critical: issues.filter(issue => issue.severity === 'critical').length,
    warning: issues.filter(issue => issue.severity === 'warning').length,
    info: issues.filter(issue => issue.severity === 'info').length,
  };

  const codeDigits = {
    critical: Math.min(counts.critical, MAX_PER_BUCKET),
    warning: Math.min(counts.warning, MAX_PER_BUCKET),
    info: Math.min(counts.info, MAX_PER_BUCKET),
  };

  const code = `${codeDigits.critical}${codeDigits.warning}${codeDigits.info}`;

  const baseMessage = formatMessage(
    counts.critical,
    counts.warning,
    counts.info
  );
  const summary = `${counts.critical} critiques, ${counts.warning} warnings, ${counts.info} infos`;
  const message =
    counts.critical === 0 && counts.warning === 0 && counts.info === 0
      ? baseMessage
      : `${baseMessage} – ${summary}`;

  return {
    code,
    message,
    details: issues,
  };
};
