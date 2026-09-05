import React from 'react';
import { Eye, AlertCircle } from 'lucide-react';
import { type Declaration } from '@/lib/mockData';

interface Props {
  declarations: Declaration[];
}

const READABILITY_CONFIG = {
  GOOD: { cls: 'badge-pass', label: 'Good' },
  ACCEPTABLE: { cls: 'badge-review', label: 'Acceptable' },
  LOW: { cls: 'badge-flag', label: 'Low' },
};

export default function ReadabilityTable({ declarations }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          <span className="text-sm font-bold text-navy">Typography & Readability</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Declaration
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Est. Size
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Readability
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {declarations.map((decl) => {
              const cfg = READABILITY_CONFIG[decl.readabilityLabel];
              return (
                <tr
                  key={`read-${decl.id}`}
                  className="hover:bg-muted/30 transition-colors duration-100"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-navy text-sm">{decl.field}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-tabular text-sm font-semibold text-muted-foreground">
                      {decl.readabilityPx} px
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`status-badge ${cfg.cls}`}>{cfg.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-start gap-2">
        <AlertCircle size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Estimated visual readability based on AI analysis. Physical measurement
          may require calibrated inspection tools.
        </p>
      </div>
    </div>
  );
}
