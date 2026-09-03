import React, { useState, useEffect, useRef } from 'react';
import { HistoryProvider, HistoryEntry } from '../../domain/autocomplete/HistoryProvider';

export interface HistorySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: string) => void;
  currentCwd?: string;
}

export const HistorySearchModal: React.FC<HistorySearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentCwd
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const historyEntries = HistoryProvider.getInstance().getHistory();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = historyEntries
    .filter(h => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return h.command.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const now = Date.now();
      let scoreA = a.count * 10 - (now - a.lastUsed) / 10000;
      let scoreB = b.count * 10 - (now - b.lastUsed) / 10000;
      if (currentCwd && a.cwd === currentCwd) scoreA += 500;
      if (currentCwd && b.cwd === currentCwd) scoreB += 500;
      return scoreB - scoreA;
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
          onSelect(filtered[selectedIndex].command);
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

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
          width: '580px',
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
          <span style={{ fontSize: '16px', opacity: 0.6 }}>🕒</span>
          <input 
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search command history with frecency (Ctrl+R)..."
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
            ESC
          </span>
        </div>

        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
              No matching commands in history
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isAi = item.command.startsWith('>');
              return (
                <div 
                  key={`${item.command}-${idx}`}
                  onClick={() => {
                    onSelect(item.command);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <span style={{
                      fontSize: '11px',
                      color: isAi ? '#f59e0b' : '#38bdf8',
                      flexShrink: 0
                    }}>
                      {isAi ? '✨' : '$'}
                    </span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      color: isSelected ? '#38bdf8' : '#f8fafc',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.command}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }}>
                      {item.count}×
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                      {formatTimeAgo(item.lastUsed)}
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
          <span>{filtered.length} history items</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>↵</kbd> Insert command</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>ESC</kbd> Cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
