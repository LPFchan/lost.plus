import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { ARTICLES, NEWS } from './src/articles.ts';
import { call, en, ko } from './src/i18n.ts';

const BASE_URL = 'https://lost.plus';
const AUTH_URL = 'https://auth.lost.plus';
const HARNESSES = ['Claude Code', 'Codex', 'OpenCode', 'Hermes', 'Antigravity', 'T3 Code'];
const ACCOUNTS = ['Google', 'iCloud', 'Microsoft'];

const clean = (s: string) => s.replace(/[\u200b\u2060]/g, '').replace(/\n+/g, ' ').trim();
const joinAnd = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}` : (items[0] ?? '');

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function renderPrerenderHtml(): string {
  const articlesHtml = ARTICLES.map(
    (a) =>
      `        <li><a href="/${esc(a.slug)}"><time datetime="${esc(a.date)}">${esc(a.date)}</time> — <strong>${esc(a.title)}</strong>: ${esc(a.en)}</a></li>`,
  ).join('\n');

  return `<main class="prerender">
      <p><a href="${esc(NEWS.en.href)}"><strong>NEW</strong> ${esc(NEWS.en.title)}: ${esc(NEWS.en.text)}</a></p>
      <header>
        <h1>${esc(clean(en.title))}</h1>
        <p>${esc(clean(en.tagline))}</p>
      </header>
      <section>
        <h2>${esc(clean(en.drift))}</h2>
        <p>Keep ${esc(joinAnd(en.rows))} in sync across your laptop, desktop, mini PC, and NAS.</p>
      </section>
      <section>
        <h2>${esc(clean(en.mesh))}</h2>
      </section>
      <section>
        <h2>${esc(clean(en.agents))}</h2>
        <p>One shared <code>AGENTS.md</code> across ${esc(HARNESSES.join(', '))}.</p>
      </section>
      <section>
        <h2>${esc(clean(en.tools))}</h2>
        <p>Connected accounts: ${esc(ACCOUNTS.join(', '))} (mail, calendar, contacts, and files).</p>
      </section>
      <section>
        <h2>${esc(clean(en.cloud))}</h2>
        <p>Self-hosted file search at <a href="https://shares.lost.plus">shares.lost.plus</a> and photo library management at <a href="https://photos.lost.plus">photos.lost.plus</a>.</p>
      </section>
      <section>
        <h2>${esc(clean(en.join))}</h2>
        <p><a href="${AUTH_URL}">${esc(clean(en.door))}</a></p>
      </section>
      <section>
        <h2>Research &amp; articles</h2>
        <ul>
${articlesHtml}
        </ul>
      </section>
      <footer>
        <p>lost.plus · <a href="https://github.com/LPFchan">github</a> · <a href="/rss.xml">RSS</a> · <a href="/index.md">Markdown</a> · <a href="/llms.txt">llms.txt</a></p>
      </footer>
    </main>`;
}

function buildJsonLd(): string {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        url: `${BASE_URL}/`,
        name: 'lost.plus',
        alternateName: clean(en.title),
        description: clean(en.tagline),
        inLanguage: 'en',
        author: {
          '@type': 'Person',
          name: 'yeowool suh',
          url: `${BASE_URL}/`,
          sameAs: ['https://github.com/LPFchan'],
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${BASE_URL}/#webpage`,
        url: `${BASE_URL}/`,
        name: `${clean(en.title)} · lost.plus`,
        description: clean(en.tagline),
        isPartOf: { '@id': `${BASE_URL}/#website` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'fleet',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Linux',
        url: `${BASE_URL}/`,
        downloadUrl: AUTH_URL,
        description: `${clean(en.tagline)} ${clean(en.mesh)}`,
      },
    ],
  };
  return JSON.stringify(graph).replaceAll('<', '\\u003c');
}

function buildMarkdownEn(): string {
  const articles = ARTICLES.map(
    (a) => `- [${a.title}](${BASE_URL}/${a.slug}.md) (${a.date}): ${a.en}`,
  ).join('\n');
  const latest = ARTICLES[0];

  return [
    '---',
    `title: ${JSON.stringify(clean(en.title))}`,
    `description: ${JSON.stringify(clean(en.tagline))}`,
    'lang: en',
    `url: ${BASE_URL}/`,
    `llms: ${BASE_URL}/llms.txt`,
    `rss: ${BASE_URL}/rss.xml`,
    '---',
    '',
    `# ${clean(en.title)}`,
    '',
    `> ${clean(en.tagline)}`,
    '',
    ...(latest ? [`- **Latest**: [${NEWS.en.title}](${BASE_URL}/${latest.slug}.md) — ${NEWS.en.text}`] : []),
    `- **Join**: ${AUTH_URL}`,
    `- **Korean version**: ${BASE_URL}/index.ko.md`,
    `- **Site index for agents**: ${BASE_URL}/llms.txt`,
    '',
    '## What Fleet does',
    '',
    `- **Stop machine drift**: ${clean(en.drift)} Fleet syncs ${joinAnd(en.rows)} across your laptop, desktop, mini PC, and NAS.`,
    `- **Mesh networking & sync**: ${clean(en.mesh)}`,
    `- **Multi-harness coding agents**: ${clean(en.agents)} One shared \`AGENTS.md\` across ${HARNESSES.join(', ')}.`,
    `- **Connected accounts**: ${clean(en.tools)} Connect ${ACCOUNTS.join(', ')} once for mail, calendar, contacts, and files.`,
    `- **Self-hosted cloud & photos**: ${clean(en.cloud)} Search files across your own machines at https://shares.lost.plus and manage your photo library at https://photos.lost.plus.`,
    `- **Join the fleet**: ${clean(en.join)} Sign in at ${AUTH_URL}.`,
    '',
    '## Research & articles',
    '',
    articles,
    '',
    '## Links',
    '',
    `- GitHub: https://github.com/LPFchan`,
    `- RSS: ${BASE_URL}/rss.xml`,
    `- llms.txt: ${BASE_URL}/llms.txt`,
    '',
  ].join('\n');
}

function buildMarkdownKo(): string {
  const articles = ARTICLES.map(
    (a) => `- [${a.title}](${BASE_URL}/${a.slug}.ko.md) (${a.date}): ${a.ko}`,
  ).join('\n');
  const latest = ARTICLES[0];

  return [
    '---',
    `title: ${JSON.stringify(clean(ko.title))}`,
    `description: ${JSON.stringify(clean(ko.tagline))}`,
    'lang: ko',
    `url: ${BASE_URL}/?lang=ko`,
    `llms: ${BASE_URL}/llms.txt`,
    `rss: ${BASE_URL}/rss.xml`,
    '---',
    '',
    `# ${clean(ko.title)}`,
    '',
    `> ${clean(ko.tagline)}`,
    '',
    ...(latest ? [`- **최신 글**: [${NEWS.ko.title}](${BASE_URL}/${latest.slug}.ko.md) — ${NEWS.ko.text}`] : []),
    `- **합류하기**: ${AUTH_URL}`,
    `- **English version**: ${BASE_URL}/index.md`,
    `- **에이전트용 사이트 인덱스**: ${BASE_URL}/llms.txt`,
    '',
    '## 플릿이 하는 일',
    '',
    `- **기기 간 설정 동기화**: ${clean(ko.drift)} ${ko.rows.join(', ')}를 노트북, 데스크톱, 미니 PC, NAS에 똑같이 맞춥니다.`,
    `- **메시 네트워크와 동기화**: ${clean(ko.mesh)}`,
    `- **여러 코딩 에이전트 하네스 지원**: ${clean(ko.agents)} ${HARNESSES.join(', ')}가 하나의 \`AGENTS.md\`를 공유합니다.`,
    `- **계정 한 번 연결**: ${clean(ko.tools)}`,
    `- **셀프호스팅 클라우드와 사진 보관함**: ${clean(ko.cloud)} (https://shares.lost.plus, https://photos.lost.plus)`,
    `- **에이전트 전화 호출**: ${clean(call.title)}`,
    `- **${clean(ko.door)}**: ${clean(ko.join)} ${AUTH_URL}`,
    '',
    '## Research & articles',
    '',
    articles,
    '',
    '## Links',
    '',
    `- GitHub: https://github.com/LPFchan`,
    `- RSS: ${BASE_URL}/rss.xml`,
    `- llms.txt: ${BASE_URL}/llms.txt`,
    '',
  ].join('\n');
}

/** Pre-render semantic HTML into index.html, inject JSON-LD, and emit index.md / index.ko.md. */
function agentAndSeo(): Plugin {
  return {
    name: 'agent-and-seo',
    transformIndexHtml(html) {
      return {
        html: html.replace('<!--PRERENDER-->', renderPrerenderHtml()),
        tags: [
          {
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: buildJsonLd(),
            injectTo: 'head',
          },
        ],
      };
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'index.md', source: buildMarkdownEn() });
      this.emitFile({ type: 'asset', fileName: 'index.ko.md', source: buildMarkdownKo() });
    },
  };
}

/** Start downloading Gaegu (18 KB, used for Latin in almost every language)
    in parallel with the JS and CSS bundles instead of waiting for mount. */
function preloadGaegu(): Plugin {
  return {
    name: 'preload-gaegu',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const asset = Object.keys(ctx.bundle ?? {}).find((k) => /gaegu-latin-300-normal.*\.woff2$/.test(k));
        if (!asset) return [];
        return [{ tag: 'link', attrs: { rel: 'preload', href: `/${asset}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    agentAndSeo(),
    preloadGaegu(),
    // The launcher this page replaced was an installable PWA whose service
    // worker cached the whole site. This ships a worker at the same URL that
    // unregisters itself and clears those caches, so returning visitors get
    // the new page instead of the copy they have stored.
    VitePWA({ selfDestroying: true, manifest: false, injectRegister: null }),
  ],
});
