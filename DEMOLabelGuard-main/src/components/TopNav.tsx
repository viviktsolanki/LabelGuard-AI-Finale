'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { Menu, X, ScanLine, BarChart3, Map, History, FileText, GitCompare } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Scan', href: '/', icon: <ScanLine size={16} /> },
  { label: 'Analysis', href: '/analysis', icon: <BarChart3 size={16} /> },
  { label: 'Compliance Map', href: '/compliance-map', icon: <Map size={16} /> },
  { label: 'Compare', href: '/compare', icon: <GitCompare size={16} /> },
  { label: 'History', href: '/history', icon: <History size={16} /> },
  { label: 'Report', href: '/report', icon: <FileText size={16} /> },
];

interface TopNavProps {
  currentRoute?: string;
}

export default function TopNav({ currentRoute }: TopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-12 2xl:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <AppLogo size={32} />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-base text-navy tracking-tight">
                LabelGuard
                <span className="text-accent"> AI</span>
              </span>
              <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                Visual Compliance Copilot
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentRoute === item.href;
              return (
                <Link
                  key={`nav-${item.href}`}
                  href={item.href}
                  className={`focus-ring flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="focus-ring hidden sm:flex btn-primary text-xs px-4 py-2 rounded-lg"
            >
              <ScanLine size={14} />
              New Scan
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="focus-ring md:hidden btn-ghost p-2 rounded-lg"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-3 pb-4 space-y-1">
            {navItems.map((item) => {
              const isActive = currentRoute === item.href;
              return (
                <Link
                  key={`mobile-nav-${item.href}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
