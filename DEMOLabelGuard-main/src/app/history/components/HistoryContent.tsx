'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Search, CheckCircle2, AlertCircle, XCircle, ArrowRight, Calendar, Tag, ScanLine } from 'lucide-react';
import { DEMO_PRODUCTS, type ProductAnalysis } from '@/lib/mockData';
import { getAllRealProducts } from '@/lib/realProduct';

interface HistoryItem extends ProductAnalysis {
  scanDate: string;
  /** The id to link to on the Compliance Map / Report / Compare pages.
   * For demo variations below this differs from `id` (see comment at
   * DEMO_HISTORY_ITEMS); for real scans it's always the same as `id`. */
  linkId: string;
  isReal: boolean;
}

// Extend demo products with extra history entries using the same data
// model. These ids (e.g. `product-a-002`) are cosmetic variations for demo
// purposes only — they don't exist as separate ProductAnalysis records, so
// `linkId` maps them back to the real demo product id (`-001`) that the
// Compliance Map / Report / Compare pages can actually resolve.
const DEMO_HISTORY_ITEMS: HistoryItem[] = [
  { ...DEMO_PRODUCTS[1], id: 'product-b-001', linkId: 'product-b-001', isReal: false, scanDate: '29 Aug 2026, 17:15' },
  { ...DEMO_PRODUCTS[0], id: 'product-a-001', linkId: 'product-a-001', isReal: false, scanDate: '29 Aug 2026, 14:42' },
  { ...DEMO_PRODUCTS[2], id: 'product-c-001', linkId: 'product-c-001', isReal: false, scanDate: '29 Aug 2026, 11:08' },
  {
    ...DEMO_PRODUCTS[0],
    id: 'product-a-002',
    linkId: 'product-a-001',
    isReal: false,
    name: 'Sunrise Basmati Rice 5kg',
    qualityScore: 91,
    passCount: 7,
    reviewCount: 1,
    flagCount: 0,
    scanDate: '28 Aug 2026, 09:30',
  },
  {
    ...DEMO_PRODUCTS[1],
    id: 'product-b-002',
    linkId: 'product-b-001',
    isReal: false,
    name: 'NutriMax Muesli 400g',
    qualityScore: 72,
    passCount: 4,
    reviewCount: 2,
    flagCount: 2,
    scanDate: '27 Aug 2026, 16:55',
  },
  {
    ...DEMO_PRODUCTS[2],
    id: 'product-c-002',
    linkId: 'product-c-001',
    isReal: false,
    name: 'CleanHome Floor Cleaner 1L',
    qualityScore: 78,
    passCount: 5,
    reviewCount: 2,
    flagCount: 1,
    scanDate: '26 Aug 2026, 13:20',
  },
];

function StatusBadge({ count, type }: { count: number; type: 'pass' | 'review' | 'flag' }) {
  if (type === 'pass')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pass/10 text-pass text-xs font-semibold">
        <CheckCircle2 size={10} /> {count} PASS
      </span>
    );
  if (type === 'review')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-review/10 text-review text-xs font-semibold">
        <AlertCircle size={10} /> {count} REVIEW
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-flag/10 text-flag text-xs font-semibold">
      <XCircle size={10} /> {count} FLAG
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-pass' : score >= 70 ? 'bg-review' : 'bg-flag';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-navy w-8 text-right">{score}</span>
    </div>
  );
}

function getOverallStatus(item: ProductAnalysis): 'PASS' | 'REVIEW' | 'FLAG' {
  if (item.flagCount > 0) return 'FLAG';
  if (item.reviewCount > 0) return 'REVIEW';
  return 'PASS';
}

export default function HistoryContent() {
  const [query, setQuery] = useState('');
  const [realItems, setRealItems] = useState<HistoryItem[]>([]);

  // Real scans live in localStorage — only readable client-side, so they're
  // loaded after mount. Every successful real analysis is already saved by
  // saveRealProduct() during the analysis step, so simply reading all of
  // them here is enough to make them show up in History.
  useEffect(() => {
    const real = getAllRealProducts().map((p) => ({
      ...p,
      linkId: p.id,
      isReal: true,
      scanDate: p.analyzedAt,
    }));
    setRealItems(real);
  }, []);

  // Real scans first (most recent first, already the order getAllRealProducts
  // returns), demo entries after.
  const historyItems: HistoryItem[] = [...realItems, ...DEMO_HISTORY_ITEMS];

  const filtered = historyItems.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <History size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">Inspection History</h1>
            <p className="text-sm text-muted-foreground">Previous product label scans</p>
          </div>
        </div>
        <Link href="/" className="btn-primary text-sm px-4 py-2">
          + New Scan
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by product name or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Scans', value: historyItems.length, color: 'text-navy' },
          { label: 'Avg. Score', value: historyItems.length ? Math.round(historyItems.reduce((s, i) => s + i.qualityScore, 0) / historyItems.length) : 0, color: 'text-accent' },
          { label: 'With FLAGS', value: historyItems.filter(i => i.flagCount > 0).length, color: 'text-flag' },
          { label: 'All PASS', value: historyItems.filter(i => i.flagCount === 0 && i.reviewCount === 0).length, color: 'text-pass' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* History list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-muted-foreground text-sm">No scans match your search.</p>
          </div>
        )}
        {filtered.map((item) => {
          const overallStatus = getOverallStatus(item);
          return (
            <Link
              key={item.id}
              href={`/compliance-map?product=${item.linkId}`}
              className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-accent/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4 min-w-0">
              {/* Score */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center">
                <span className={`text-lg font-extrabold leading-none ${item.qualityScore >= 85 ? 'text-pass' : item.qualityScore >= 70 ? 'text-review' : 'text-flag'}`}>
                  {item.qualityScore}
                </span>
                <span className="text-[9px] text-muted-foreground font-medium">/100</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-navy truncate">{item.name}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    <Tag size={9} /> {item.category}
                  </span>
                  {item.isReal ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                      <ScanLine size={9} /> Real scan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                      Demo
                    </span>
                  )}
                  {/* Overall status badge */}
                  {overallStatus === 'FLAG' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-flag/10 text-flag text-xs font-semibold">
                      <XCircle size={9} /> FLAG
                    </span>
                  )}
                  {overallStatus === 'REVIEW' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-review/10 text-review text-xs font-semibold">
                      <AlertCircle size={9} /> REVIEW
                    </span>
                  )}
                  {overallStatus === 'PASS' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pass/10 text-pass text-xs font-semibold">
                      <CheckCircle2 size={9} /> PASS
                    </span>
                  )}
                </div>
                <ScoreBar score={item.qualityScore} />
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge count={item.passCount} type="pass" />
                  {item.reviewCount > 0 && <StatusBadge count={item.reviewCount} type="review" />}
                  {item.flagCount > 0 && <StatusBadge count={item.flagCount} type="flag" />}
                </div>
              </div>
              </div>

              {/* Date + arrow */}
              <div className="flex-shrink-0 flex items-center justify-between sm:flex-col sm:items-end gap-2 pl-16 sm:pl-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar size={11} />
                  {item.scanDate}
                </div>
                <ArrowRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
