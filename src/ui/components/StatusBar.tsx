import React, { useEffect, useState } from 'react';

import { invoke } from '@tauri-apps/api/core';

export interface StatusBarProps {
  currentShell?: string;
  currentPath?: string;
  onNavigate?: (targetPath: string, commandToExecute: string) => void;
  onOpenPorts?: () => void;
  onOpenWorkspaces?: () => void;
  memoryUsage?: number; // MB
  cpuUsage?: number; // %
  currentProfile?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  currentShell = 'zsh', 
  currentPath = '~',
  onNavigate,
  onOpenPorts,
  onOpenWorkspaces,
  memoryUsage: initialMemory = 145,
  cpuUsage: initialCpu = 2.4,
  currentProfile = 'Developer'
}) => {
  const [memoryUsage, setMemoryUsage] = useState(initialMemory);
  const [cpuUsage, setCpuUsage] = useState(initialCpu);
  const [currentTime, setCurrentTime] = useState(() => 
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Only poll if Tauri is available
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      const interval = setInterval(async () => {
        try {
          const stats = await invoke<{ memory_used: number, cpu_usage: number }>('get_system_stats');
          setMemoryUsage(stats.memory_used);
          setCpuUsage(parseFloat(stats.cpu_usage.toFixed(1)));
        } catch (e) {
          console.error("Failed to fetch system stats:", e);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  // Parse path into clickable breadcrumb steps
  const getBreadcrumbs = () => {
    const clean = currentPath.replace(/\/+/g, '/').trim() || '~';
    const parts = clean === '/' ? ['/'] : clean.split('/').filter(Boolean);
    return parts.map((part, idx) => {
      let fullPath = parts.slice(0, idx + 1).join('/');
      if (parts[0] === '~' && idx === 0) fullPath = '~';
      else if (parts[0] === '~') fullPath = parts.slice(0, idx + 1).join('/');
      else if (currentPath.startsWith('/') && !fullPath.startsWith('/')) fullPath = '/' + fullPath;
      
      const cmd = fullPath === '~' ? 'cd ~' : `cd "${fullPath}"`;
      return { name: part === '~' ? '🏠 home' : `📁 ${part}`, fullPath, cmd, isLast: idx === parts.length - 1 };
    });
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px',
      backgroundColor: 'var(--sentinel-bg, rgba(13, 17, 23, 0.85))',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      color: 'var(--sentinel-fg, #E2E8F0)',
      fontSize: '12px',
      fontFamily: 'var(--sentinel-font, "Fira Code", monospace)',
      userSelect: 'none',
      height: '32px',
      boxSizing: 'border-box',
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflowX: 'auto' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85, fontWeight: 500 }}>
          <span style={{ color: 'var(--sentinel-blue, #3B82F6)' }}>⚡</span>
          {currentShell}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {getBreadcrumbs().map((bc, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: 'var(--sentinel-cyan, #06B6D4)', opacity: 0.5, margin: '0 2px' }}>❯</span>}
              <button
                onClick={() => onNavigate && onNavigate(bc.fullPath, bc.cmd)}
                title={`Click to navigate to ${bc.fullPath}`}
                style={{
                  background: bc.isLast ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  border: bc.isLast ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid transparent',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  color: bc.isLast ? 'var(--sentinel-cyan, #06B6D4)' : 'var(--sentinel-fg, #E2E8F0)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  fontWeight: bc.isLast ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  if (!bc.isLast) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseOut={(e) => {
                  if (!bc.isLast) e.currentTarget.style.background = 'transparent';
                }}
              >
                {bc.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {onOpenWorkspaces && (
          <button
            onClick={onOpenWorkspaces}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: '#e2e8f0',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Switch Workspace (Cmd+O)"
          >
            <span>📁</span> Projects <kbd style={{ opacity: 0.5, fontSize: '9px' }}>⌘O</kbd>
          </button>
        )}

        {onOpenPorts && (
          <button
            onClick={onOpenPorts}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: '#e2e8f0',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Inspect & Free Listening Ports"
          >
            <span>🔌</span> Ports
          </button>
        )}

        <span style={{ opacity: 0.75, fontSize: '11px' }}>Mem: <strong>{memoryUsage} MB</strong></span>
        <span style={{ opacity: 0.75, fontSize: '11px' }}>CPU: <strong>{cpuUsage}%</strong></span>
        
        {/* Unified Intelligence Status HUD */}
        <span 
          title="Sentinel Hybrid Intelligence: 70+ TLDR Ground-Truth Recipes | 59 Deterministic Remediation Rules | Hardware GBNF Grammar Constraints | Concrete Shell AST Syntactic Guard | Shadow-PTY Minority Report Simulation"
          style={{ 
            backgroundColor: 'rgba(139, 92, 246, 0.18)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            padding: '2px 8px',
            borderRadius: '4px',
            color: '#c4b5fd',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'default'
          }}
        >
          <span>⚡</span> SERL & Oracles
        </span>

        <span style={{ 
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '2px 8px',
          borderRadius: '4px',
          color: 'var(--sentinel-cyan, #38BDF8)',
          fontSize: '11px',
          fontWeight: 600
        }}>
          🛡️ {currentProfile}
        </span>
        
        {/* Rightmost real-time clock */}
        <span style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          paddingLeft: '10px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--sentinel-fg, #ffffff)'
        }}>
          <span style={{ color: 'var(--sentinel-green, #10B981)', animation: 'pulse 2s infinite' }}>🕒</span>
          <span style={{ letterSpacing: '0.5px' }}>{currentTime}</span>
        </span>
      </div>
    </div>
  );
};
