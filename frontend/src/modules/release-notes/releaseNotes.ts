import releaseNotesSource from './release-notes.json';

export type ReleaseCategoryKey = 'features' | 'improvements' | 'fixes' | 'security';

export type ReleaseNote = {
  version: string;
  releasedAt: string;
  summary: string;
  features: string[];
  improvements: string[];
  fixes: string[];
  security: string[];
};

export const releaseNotes = releaseNotesSource.releases as ReleaseNote[];
export const currentRelease = releaseNotes[0];

export const releaseCategoryDefinitions: Array<{
  key: ReleaseCategoryKey;
  label: string;
}> = [
  { key: 'features', label: '新增功能' },
  { key: 'improvements', label: '功能优化' },
  { key: 'fixes', label: '问题修复' },
  { key: 'security', label: '安全与稳定性' }
];
