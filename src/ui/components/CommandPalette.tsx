import React, { useState, useEffect } from 'react';

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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'var(--sentinel-bg-solid)',
        width: '500px',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <input 
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search commands, settings, workflows..."
          style={{
            padding: '16px',
            fontSize: '16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--sentinel-fg)',
            outline: 'none',
            fontFamily: 'var(--sentinel-font)'
          }}
        />
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                color: 'var(--sentinel-fg)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--sentinel-font)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sentinel-selection)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ fontWeight: 'bold' }}>{c.name}</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>{c.description}</div>
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding: '16px', opacity: 0.5, color: 'var(--sentinel-fg)' }}>No results found.</div>
          )}
        </div>
      </div>
    </div>
  );
};
