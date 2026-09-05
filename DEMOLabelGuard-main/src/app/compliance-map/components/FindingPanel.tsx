'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { type Declaration, type Finding, type DeclarationStatus } from '@/lib/mockData';

interface Props {
  declarations: Declaration[];
  findings: Finding[];
  selectedDeclarationId: string | null;
  onSelectDeclaration: (id: string | null) => void;
  onHoverDeclaration: (id: string | null) => void;
}

type FilterStatus = 'ALL' | DeclarationStatus;

const STATUS_ICON = {
  PASS: <CheckCircle2 size={14} className="text-pass flex-shrink-0" />,
  REVIEW: <AlertTriangle size={14} className="text-review flex-shrink-0" />,
  FLAG: <XCircle size={14} className="text-flag flex-shrink-0" />,
};

const STATUS_BADGE_CLS = {
  PASS: 'badge-pass',
  REVIEW: 'badge-review',
  FLAG: 'badge-flag',
};

export default function FindingsPanel({
  declarations,
  findings,
  selectedDeclarationId,
  onSelectDeclaration,
  onHoverDeclaration,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [expanded, setExpanded] = useState(true);

  const filtered = declarations.filter(
    (d) => filterStatus === 'ALL' || d.status === filterStatus
  );

  const passCount = declarations.filter((d) => d.status === 'PASS').length;
  const reviewCount = declarations.filter((d) => d.status === 'REVIEW').length;
  const flagCount = declarations.filter((d) => d.status === 'FLAG').length;

  const filterOptions: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: declarations.length },
    { key: 'FLAG', label: 'Flag', count: flagCount },
    { key: 'REVIEW', label: 'Review', count: reviewCount },
    { key: 'PASS', label: 'Pass', count: passCount },
  ];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-sm font-bold text-navy">Findings</span>
          <span className="text-xs text-muted-foreground">
            {declarations.length} declarations
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-ghost p-1.5 rounded-lg"
          aria-label="Toggle findings panel"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border overflow-x-auto">
            {filterOptions.map((opt) => (
              <button
                key={`filter-${opt.key}`}
                onClick={() => setFilterStatus(opt.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  filterStatus === opt.key
                    ? 'bg-accent/10 text-accent border border-accent/20' :'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                }`}
              >
                {opt.label}
                <span
                  className={`px-1 rounded font-tabular ${
                    filterStatus === opt.key ? 'bg-accent text-white' : 'bg-border text-muted-foreground'
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            ))}
          </div>

          {/* Hint */}
          <div className="px-4 py-2 bg-accent/5 border-b border-border">
            <p className="text-xs text-accent/80">
              ↗ Click any finding to highlight evidence on the image
            </p>
          </div>

          {/* Declarations list */}
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No declarations matching this filter
              </div>
            ) : (
              filtered.map((decl) => {
                const finding = findings.find((f) => f.declarationId === decl.id);
                const isSelected = selectedDeclarationId === decl.id;

                return (
                  <button
                    key={`finding-row-${decl.id}`}
                    onClick={() => onSelectDeclaration(decl.id)}
                    onMouseEnter={() => onHoverDeclaration(decl.id)}
                    onMouseLeave={() => onHoverDeclaration(null)}
                    className={`w-full text-left px-4 py-3 transition-all duration-150 finding-row-hover ${
                      isSelected ? 'finding-selected' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {STATUS_ICON[decl.status]}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-navy truncate">
                            {decl.field}
                          </span>
                          <span className={`status-badge ${STATUS_BADGE_CLS[decl.status]} flex-shrink-0 text-xs`}>
                            {decl.status}
                          </span>
                        </div>

                        {/* Extracted text */}
                        <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                          {decl.extractedText || decl.value}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5">
                          {/* Confidence bar */}
                          <div className="flex items-center gap-1.5 flex-1">
                            <div className="confidence-bar flex-1">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${decl.confidence}%`,
                                  backgroundColor:
                                    decl.confidence >= 80
                                      ? 'var(--pass)'
                                      : decl.confidence >= 60
                                      ? 'var(--review)'
                                      : 'var(--flag)',
                                  transition: 'width 0.6s ease-out',
                                }}
                              />
                            </div>
                            <span className="text-xs font-tabular font-bold text-muted-foreground">
                              {decl.confidence}%
                            </span>
                          </div>

                          {/* Rule check short label */}
                          {finding && (
                            <span className="text-xs text-muted-foreground/60 font-mono text-right flex-shrink-0 truncate max-w-[80px]">
                              {decl.ruleId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
