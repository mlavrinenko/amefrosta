import type { PackCode } from '../packs';

// Owner/repo the "new issue" link targets. Update if the repo moves.
const REPO = 'mlavrinenko/amefrosta';
const NEW_ISSUE = `https://github.com/${REPO}/issues/new`;

interface Template {
  /** Prefilled issue title; the reporter finishes the sentence. */
  title: string;
  /** Prefilled markdown body, above the auto-filled environment block. */
  body: string;
  /** Heading for the environment block appended at click time. */
  envHeading: string;
  /** Row labels for the environment block, in order: app, language, device. */
  envRows: [app: string, language: string, device: string];
}

// One template per language. The picked template mirrors the app's current
// game language, so a Russian player files in Russian without a chooser step.
const TEMPLATES: Record<PackCode, Template> = {
  en: {
    title: 'Feedback: ',
    body: [
      '## What happened?',
      '',
      '<!-- Describe the bug or the idea. Screenshots welcome. -->',
      '',
      '## Steps to reproduce (bugs only)',
      '',
      '1. ',
      '',
      '## What did you expect?',
      '',
    ].join('\n'),
    envHeading: '## Environment',
    envRows: ['App', 'Language', 'Device'],
  },
  ru: {
    title: 'Отзыв: ',
    body: [
      '## Что случилось?',
      '',
      '<!-- Опишите ошибку или идею. Скриншоты приветствуются. -->',
      '',
      '## Как воспроизвести (только для ошибок)',
      '',
      '1. ',
      '',
      '## Что вы ожидали?',
      '',
    ].join('\n'),
    envHeading: '## Окружение',
    envRows: ['Приложение', 'Язык', 'Устройство'],
  },
};

function appVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}

function device(): string {
  return typeof navigator !== 'undefined' && navigator.userAgent
    ? navigator.userAgent
    : 'unknown';
}

/**
 * Build a GitHub "new issue" URL prefilled with a template in the app's current
 * language plus an environment block (version, language, device) so a bug report
 * arrives with the context triage needs. `version`/`platform` are injectable so
 * the builder stays pure for tests.
 */
export function feedbackUrl(
  lang: PackCode,
  { version = appVersion(), platform = device() }: { version?: string; platform?: string } = {},
): string {
  const tpl = TEMPLATES[lang] ?? TEMPLATES.en;
  const [appRow, langRow, deviceRow] = tpl.envRows;
  const body = [
    tpl.body,
    tpl.envHeading,
    `- ${appRow}: Amefrosta ${version}`,
    `- ${langRow}: ${lang}`,
    `- ${deviceRow}: ${platform}`,
  ].join('\n');
  const params = new URLSearchParams({
    labels: 'feedback',
    title: tpl.title,
    body,
  });
  return `${NEW_ISSUE}?${params.toString()}`;
}
