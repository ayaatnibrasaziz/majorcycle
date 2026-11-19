// Tell the IndexNow engines (Bing, and through it DuckDuckGo and ChatGPT search; Yandex;
// Seznam; Naver) about every page in the LIVE sitemap. Run after a production deploy:
//
//   pnpm indexnow            submit every sitemap URL
//   pnpm indexnow --dry-run  print what would be sent, send nothing
//
// Why the live sitemap and not the registry: what Bing should be told about is what the
// site actually serves, after the deploy, not what this checkout believes it will.
// The key is public by design (lib/indexnow.ts); the engine checks it against
// https://www.majorcycle.com/<key>.txt, so the script first confirms that file is live
// and says so, rather than sending a submission that can only be rejected.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://www.majorcycle.com';
const src = readFileSync(fileURLToPath(new URL('../lib/indexnow.ts', import.meta.url)), 'utf8');
const KEY = src.match(/INDEXNOW_KEY = '([0-9a-f]{32})'/)?.[1];
if (!KEY) throw new Error('INDEXNOW_KEY not found in lib/indexnow.ts');
const dry = process.argv.includes('--dry-run');

const keyRes = await fetch(`${SITE}/${KEY}.txt`, { redirect: 'manual' });
const keyBody = (await keyRes.text()).trim();
if (keyRes.status !== 200 || keyBody !== KEY) {
  console.error(`The key file is not live (status ${keyRes.status}). Deploy first; a submission now would be rejected.`);
  process.exit(1);
}

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urls.length === 0) {
  console.error('The live sitemap lists no URLs; nothing to submit.');
  process.exit(1);
}
const body = { host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls };
console.log(`${urls.length} URLs from the live sitemap; key file live.`);
if (dry) {
  console.log(urls.join('\n'));
  process.exit(0);
}
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
// 200 = accepted; 202 = received, key being verified. Anything else is a failure worth reading.
console.log(`IndexNow answered ${r.status} ${r.statusText}`);
if (r.status !== 200 && r.status !== 202) {
  console.error(await r.text());
  process.exit(1);
}
