/**
 * IndexNow: how Bing (and DuckDuckGo and ChatGPT search, which read Bing's index), Yandex,
 * Seznam and Naver hear about new pages without waiting to crawl.
 *
 * SEO audit 2026-11-19: Bing held about 9 of our pages and NO articles, while Google held
 * 42. IndexNow needs no account. The engine fetches `/<key>.txt` from our own domain;
 * finding the key there is the proof the request came from us.
 *
 * The key is PUBLIC by design (it is served to anyone), so it lives in the repo and is not
 * a secret. The matching file is `public/<key>.txt`. Change both together, or every
 * submission is rejected 403.
 *
 * Submit after each production deploy: `pnpm indexnow` (scripts/indexnow.mjs) sends every
 * URL in the live sitemap.
 */
export const INDEXNOW_KEY = '54ebe61ebed697c9e618a026a78e07ca';
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
