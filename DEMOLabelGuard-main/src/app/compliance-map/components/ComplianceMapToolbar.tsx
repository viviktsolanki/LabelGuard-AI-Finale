'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  GitCompare,
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { type ProductAnalysis } from '@/lib/mockData';

interface Props {
  product: ProductAnalysis;
}

export default function ComplianceMapToolbar({ product }: Props) {
  const router = useRouter();

  const overallStatus =
    product.flagCount > 0 ? 'FLAG' : product.reviewCount > 0 ? 'REVIEW' : 'PASS';

  const statusConfig = {
    PASS: {
      label: 'All Clear',
      icon: <CheckCircle2 size={14} />,
      cls: 'badge-pass',
    },
    REVIEW: {
      label: `${product.reviewCount} Review`,
      icon: <AlertTriangle size={14} />,
      cls: 'badge-review',
    },
    FLAG: {
      label: `${product.flagCount} Flagged`,
      icon: <XCircle size={14} />,
      cls: 'badge-flag',
    },
  };

  const cfg = statusConfig[overallStatus];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left: breadcrumb + product info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push('/')}
          className="focus-ring btn-ghost p-2 rounded-lg flex-shrink-0"
          aria-label="Back to scan"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold text-navy truncate">{product.name}</h1>
            <span className={`status-badge ${cfg.cls} flex-shrink-0`}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Tag size={10} />
              {product.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {product.analyzedAt}
            </span>
            <span className="text-muted-foreground/50">ID: {product.id}</span>
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
        <Link
          href={`/copilot?product=${product.id}`}
          className="focus-ring btn-secondary text-xs px-3 py-2 rounded-lg"
        >
          <MessageSquare size={14} />
          Ask LabelGuard
        </Link>
        <Link
          href={`/compare?product=${product.id}`}
          className="focus-ring btn-secondary text-xs px-3 py-2 rounded-lg"
        >
          <GitCompare size={14} />
          Compare
        </Link>
        <Link
          href={`/report?product=${product.id}`}
          className="focus-ring btn-primary text-xs px-3 py-2 rounded-lg"
        >
          <Download size={14} />
          Report
        </Link>
      </div>
    </div>
  );
}
