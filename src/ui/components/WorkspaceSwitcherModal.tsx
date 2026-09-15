import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Folder, 
  Code2, 
  FileText
} from 'lucide-react';
import { DiscoveredProject } from '../../domain/discovery/ProjectDiscoveryEngine';
import { WorkspaceRegistry } from '../../domain/discovery/WorkspaceRegistry';

export interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string, action: 'navigate' | 'new-tab', setupScript?: string) => void;
  currentCwd?: string;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentCwd
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
      registry.getProjects(true, currentCwd).then(p => {
        setProjects(p);
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, currentCwd]);

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
        e.preventDefault();
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
        return;
      }

      // Quick jump with numbers 2..9 when query is empty or with Alt/Ctrl
      if (!query && /^[2-9]$/.test(e.key)) {
        const targetIdx = parseInt(e.key, 10) - 1;
        if (filtered[targetIdx]) {
          e.preventDefault();
          onSelect(filtered[targetIdx].path, 'navigate', filtered[targetIdx].setupScript);
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelect, query]);

  if (!isOpen) return null;

  // Determine icon based on project type and name
  const getItemIcon = (proj: DiscoveredProject) => {
    const nameLower = proj.name.toLowerCase();
    const typeLower = proj.type.toLowerCase();

    if (nameLower.startsWith('.') || typeLower === 'node' || typeLower === 'rust' || typeLower === 'python' || typeLower === 'ros2' || typeLower === 'ros1') {
      return <Code2 size={16} style={{ color: 'rgba(255, 255, 255, 0.65)' }} />;
    }
    if (nameLower.includes('note') || nameLower.includes('material') || nameLower.includes('tutorial') || nameLower.includes('doc')) {
      return <FileText size={16} style={{ color: 'rgba(255, 255, 255, 0.65)' }} />;
    }
    return <Folder size={16} style={{ color: 'rgba(255, 255, 255, 0.65)' }} />;
  };

  const isCurrentProject = (path: string) => {
    if (!currentCwd) return false;
    const cleanCurrent = currentCwd.replace(/\/+$/, '');
    const cleanPath = path.replace(/\/+$/, '');
    return cleanCurrent === cleanPath;
  };

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.38)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
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
          backgroundColor: 'rgba(18, 20, 25, 0.96)',
          borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#f8fafc'
        }}
      >
        {/* Top Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <Search size={15} color="rgba(255, 255, 255, 0.45)" style={{ flexShrink: 0 }} />
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
              fontSize: '14px',
              color: '#f8fafc',
              fontWeight: 400
            }}
          />
          <span style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.4)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '2px 7px',
            borderRadius: '5px'
          }}>
            ESC to close
          </span>
        </div>

        {/* Project Items List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.35)', fontSize: '13px' }}>
              No matching projects found
            </div>
          ) : (
            filtered.map((proj, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = isCurrentProject(proj.path);
              const shortcutNumber = idx < 9 ? idx + 1 : null;

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
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                    transition: 'all 0.12s ease',
                    marginBottom: '1px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      flexShrink: 0
                    }}>
                      {getItemIcon(proj)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                        {proj.name}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.38)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '380px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
                      }}>
                        {proj.path}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {isCurrent && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'rgba(255, 255, 255, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontWeight: 400
                      }}>
                        Current
                      </span>
                    )}

                    {isSelected ? (
                      <kbd style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontFamily: 'inherit'
                      }}>
                        ↵
                      </kbd>
                    ) : shortcutNumber && shortcutNumber > 1 ? (
                      <kbd style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontFamily: 'inherit'
                      }}>
                        {shortcutNumber}
                      </kbd>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer with Keyboard Navigation Hints */}
        <div style={{
          padding: '9px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          <span>{filtered.length} item{filtered.length === 1 ? '' : 's'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>↑</kbd>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>↓</kbd>
              <span>Navigate</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>↵</kbd>
              <span>Open</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>/</kbd>
              <span>Search</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
