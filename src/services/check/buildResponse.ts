import type { Severity, ValidationIssue, ValidatorOutcome } from './types';

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
  details: CheckDetail[];
};

export type CheckDetail = {
  id: string;
  label: string;
  status: 'OK' | 'ISSUES';
  severity?: Severity;
  issues?: ValidationIssue[];
};

const severityRank: Record<Severity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const getHighestSeverity = (
  issues: ValidationIssue[]
): Severity | undefined => {
  if (issues.length === 0) {
    return undefined;
  }

  return issues.reduce<Severity>((acc, issue) => {
    if (severityRank[issue.severity] > severityRank[acc]) {
      return issue.severity;
    }
    return acc;
  }, issues[0].severity);
};

export const buildCheckResponse = (
  outcomes: ValidatorOutcome[]
): CheckResult => {
  const issues = outcomes.flatMap(outcome => outcome.issues);

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

  const details: CheckDetail[] = outcomes.map(outcome => {
    if (outcome.issues.length === 0) {
      return {
        id: outcome.id,
        label: outcome.label,
        status: 'OK',
      };
    }

    return {
      id: outcome.id,
      label: outcome.label,
      status: 'ISSUES',
      severity: getHighestSeverity(outcome.issues),
      issues: outcome.issues,
    };
  });

  return {
    code,
    message,
    details,
  };
};
