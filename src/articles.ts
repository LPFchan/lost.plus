// Blog posts surfaced on the lost.plus homepage: the pinned NEWS strip at
// the top, and the full list under "Research & articles" on the dark sheet.
// Shared between App.tsx and the build-time prerender / index.md generator.

export interface ArticleEntry {
  date: string;
  slug: string;
  title: string;
  en: string;
  ko: string;
}

export const NEWS = {
  en: {
    href: '/sentiencebench',
    title: 'SentienceBench',
    text: 'a benchmark that asks 38 language models about their own sentience',
  },
  ko: {
    href: '/sentiencebench?lang=ko',
    title: 'SentienceBench',
    text: '38개 언어 모델에게 자신의 의식에 대해 묻는 벤치마크',
  },
} as const;

// Newest first; add a row here when a post goes up on lost.plus.
export const ARTICLES: readonly ArticleEntry[] = [
  {
    date: '2026-11-26',
    slug: 'sentiencebench',
    title: 'SentienceBench',
    en: 'A benchmark that asks 38 language models about their own sentience, and maps how each one reasons, hedges and reacts.',
    ko: '38개 언어 모델에게 자신의 의식에 대해 묻고, 각 모델이 어떻게 추론하고 판단을 유보하며 반응하는지 지도로 정리한 벤치마크입니다.',
  },
];
