'use client';

import React from 'react';
import { type ComplianceScoreBreakdown } from '@/lib/mockData';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Info } from 'lucide-react';

interface Props {
  score: number;
  breakdown: ComplianceScoreBreakdown;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 85) return 'text-pass';
  if (score >= 70) return 'text-review';
  return 'text-flag';
};

const SCORE_RING_COLOR = (score: number) => {
  if (score >= 85) return 'var(--pass)';
  if (score >= 70) return 'var(--review)';
  return 'var(--flag)';
};

const BREAKDOWN_LABELS: Record<keyof ComplianceScoreBreakdown, string> = {
  mandatoryDeclarations: 'Mandatory declarations',
  readability: 'Readability',
  extractionConfidence: 'Extraction confidence',
  placementVisibility: 'Placement / visibility',
  labelConsistency: 'Label consistency',
};

export default function QualityScoreCard({ score, breakdown }: Props) {
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (score / 100) * circumference;

  const radarData = (Object.keys(breakdown) as (keyof ComplianceScoreBreakdown)[]).map((key) => ({
    subject: BREAKDOWN_LABELS[key],
    value: breakdown[key],
    fullMark: 100,
  }));

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-navy">Compliance Screening Score</h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Info size={10} />
            AI-assisted screening — not an official legal certification
          </p>
        </div>
      </div>

      {/* Score + breakdown */}
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle
              cx="45"
              cy="45"
              r="40"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
            />
            <circle
              cx="45"
              cy="45"
              r="40"
              fill="none"
              stroke={SCORE_RING_COLOR(score)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 45 45)"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-extrabold font-tabular ${SCORE_COLOR(score)}`}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 space-y-2">
          {(Object.keys(breakdown) as (keyof ComplianceScoreBreakdown)[]).map((key) => {
            const val = breakdown[key];
            return (
              <div key={`breakdown-${key}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-muted-foreground">{BREAKDOWN_LABELS[key]}</span>
                  <span className={`text-xs font-bold font-tabular ${SCORE_COLOR(val)}`}>
                    {val}
                  </span>
                </div>
                <div className="confidence-bar">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${val}%`,
                      backgroundColor: SCORE_RING_COLOR(val),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Radar chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 8, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke={SCORE_RING_COLOR(score)}
              fill={SCORE_RING_COLOR(score)}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card text-xs">
                    <p className="font-semibold text-navy">{payload[0].payload.subject}</p>
                    <p className="font-bold font-tabular text-accent">{payload[0].value}/100</p>
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
