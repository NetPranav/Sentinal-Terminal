import React, { useState, useEffect, useRef } from 'react';
import { DiscoveredProject } from '../../domain/discovery/ProjectDiscoveryEngine';
import { WorkspaceRegistry } from '../../domain/discovery/WorkspaceRegistry';

export interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string, action: 'navigate' | 'new-tab', setupScript?: string) => void;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<DiscoveredProject[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const registry = WorkspaceRegistry.getInstance();
      const cached = registry.getCachedProjects();
      if (cached.length > 0) {
        setProjects(cached);
      }
      registry.getProjects().then(p => {
        setProjects(p);
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = projects.filter(p => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          const selected = filtered[selectedIndex];
          const isNewTab = e.metaKey || e.ctrlKey;
          onSelect(selected.path, isNewTab ? 'new-tab' : 'navigate', selected.setupScript);
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelect]);

  if (!isOpen) return null;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ros2':
      case 'ros1':
        return { label: '📦 ROS', bg: 'rgba(249, 115, 22, 0.18)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.35)' };
      case 'node':
        return { label: '⚡ Node.js', bg: 'rgba(34, 197, 94, 0.18)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.35)' };
      case 'rust':
        return { label: '🦀 Rust', bg: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: 'rgba(239, 68, 68, 0.35)' };
      case 'python':
        return { label: '🐍 Python', bg: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' };
      case 'docker':
        return { label: '🐳 Docker', bg: 'rgba(14, 165, 233, 0.18)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.35)' };
      default:
        return { label: '📁 Workspace', bg: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.25)' };
    }
  };

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
        zIndex: 99999
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '92vw',
          backgroundColor: 'rgba(18, 22, 34, 0.94)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#f8fafc'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <span style={{ fontSize: '18px', opacity: 0.6 }}>🔍</span>
          <input 
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to project, workspace, or package..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#f8fafc',
              fontWeight: 500
            }}
          />
          <span style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.4)',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            ESC to close
          </span>
        </div>

        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
              No matching projects found
            </div>
          ) : (
            filtered.map((proj, idx) => {
              const isSelected = idx === selectedIndex;
              const badge = getTypeBadge(proj.type);
              return (
                <div 
                  key={proj.path}
                  onClick={() => {
                    onSelect(proj.path, 'navigate', proj.setupScript);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                      {proj.name}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.45)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '380px',
                      fontFamily: 'monospace'
                    }}>
                      {proj.path}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {proj.setupScript && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.3)'
                      }}>
                        ⚡ env
                      </span>
                    )}
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontWeight: 500
                    }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.45)'
        }}>
          <span>{filtered.length} projects discovered</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>↵</kbd> Switch cwd</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>⌘↵</kbd> New Tab</span>
          </div>
        </div>
      </div>
    </div>
  );
};
