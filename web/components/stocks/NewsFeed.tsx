import type { NewsItem } from '@/lib/types';
import { InfoTip } from '@/components/ui/InfoTip';

interface Props {
  news: NewsItem[];
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function NewsFeed({ news }: Props) {
  const shown = news ? news.slice(0, 10) : [];
  if (!news || news.length === 0) {
    return (
      <div className="card card--stack-base">
        <div className="card-header">
          <div className="card-title">Latest News</div>
        </div>
        <div className="card-body">
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            No recent news available.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--stack-base">
      <div className="card-header">
        <div className="card-title">
          Latest News
          <InfoTip title="Latest News">
            Recent headlines about the company. Tap a card to read the full article
            at the source. Headlines are informational — not a signal to act.
          </InfoTip>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {shown.length} {shown.length === 1 ? 'article' : 'articles'}
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {shown.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-row"
            style={{
              display: 'block',
              padding: '12px 18px',
              borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : undefined,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.45,
              marginBottom: 4,
            }}>
              {item.title}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--c-mid)',
                background: 'rgba(30,92,179,.10)',
                borderRadius: 4,
                padding: '1px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {item.source}
              </span>
              {item.publishedAt && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtDate(item.publishedAt)}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
