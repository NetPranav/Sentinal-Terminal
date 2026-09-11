import React, { useState, useEffect } from 'react';
import { Search, Sparkles } from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCapability?: (capabilityId: string) => void;
  capabilities?: any[]; // Mock capability list for now
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onExecuteCapability, capabilities = [] }) => {
  const [query, setQuery] = useState('');
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = capabilities.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    c.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'var(--sentinel-bg-solid, rgba(16, 20, 31, 0.96))',
        width: '540px',
        maxWidth: '92vw',
        borderRadius: '12px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Search size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <input 
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands, settings, workflows..."
            style={{
              flex: 1,
              padding: '16px 0',
              fontSize: '15px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--sentinel-fg, #fff)',
              outline: 'none',
              fontFamily: 'var(--sentinel-font, inherit)'
            }}
          />
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {results.map((c, idx) => (
            <div 
              key={c.id} 
              onClick={() => {
                if (onExecuteCapability) onExecuteCapability(c.id);
                onClose();
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                color: 'var(--sentinel-fg, #fff)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--sentinel-font, inherit)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sentinel-selection, rgba(56, 189, 248, 0.12))')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Sparkles size={14} style={{ color: '#38bdf8', marginTop: '3px', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '2px' }}>{c.description}</div>
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding: '24px', opacity: 0.5, color: 'var(--sentinel-fg, #fff)', textAlign: 'center', fontSize: '13px' }}>
              No results found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
