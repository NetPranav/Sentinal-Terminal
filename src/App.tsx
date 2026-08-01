import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { TerminalView } from "./presentation/TerminalView";
import { CommandPalette } from "./ui/components/CommandPalette";
import { StatusBar } from "./ui/components/StatusBar";
import { ThemeManager } from "./ui/theme/ThemeManager";
import { AiSettingsPage } from "./ui/components/AiSettingsPage";
import { SessionManager } from "./domain/SessionManager";
import { InstallerWizard } from "./ui/components/InstallerWizard";
import { UrlSchemeHandler } from "./domain/integration/UrlSchemeHandler";
import "./App.css";

type SplitDirection = 'vertical' | 'horizontal';

interface TerminalPane {
  id: string;
  sessionId?: string;
}

interface SplitNode {
  id: string;
  direction: SplitDirection;
  pane1: PaneNode;
  pane2: PaneNode;
}

type PaneNode = { type: 'terminal', data: TerminalPane } | { type: 'split', data: SplitNode };

interface Tab {
  id: string;
  name: string;
  rootPane: PaneNode;
}

function App() {
  const getUniqueId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

  const createTerminalPane = (): PaneNode => ({
    type: 'terminal',
    data: { id: getUniqueId('pane') }
  });

  const [tabs, setTabs] = useState<Tab[]>([{ 
    id: 'tab_initial', 
    name: 'Terminal 1', 
    rootPane: createTerminalPane() 
  }]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_initial');
  const [activePaneId, setActivePaneId] = useState<string>(''); // For focusing
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);

  // New UI & Theme customization states
  const [panePaths, setPanePaths] = useState<Record<string, string>>({});
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('classic-dark');
  const [transparency, setTransparency] = useState<number>(0.82);
  const [blurLevel, setBlurLevel] = useState<number>(20);
  const [activeShellMenuPaneId, setActiveShellMenuPaneId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState<boolean>(() => !localStorage.getItem('sentinel_onboarded'));

  useEffect(() => {
    ThemeManager.getInstance();
    const handleGlobalClick = () => setActiveShellMenuPaneId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const addTab = useCallback((customPath?: string | unknown) => {
    const newId = getUniqueId('tab');
    const newPane = createTerminalPane();
    setPanePaths(prev => ({ ...prev, [newPane.data.id]: typeof customPath === 'string' ? customPath : '~' }));
    setTabs(prev => [...prev, { id: newId, name: `Terminal ${prev.length + 1}`, rootPane: newPane }]);
    setActiveTabId(newId);
    setActivePaneId(newPane.data.id);
  }, []);

  useEffect(() => {
    let unlistenMenu: (() => void) | undefined;
    let unlistenUrl: (() => void) | undefined;
    listen<string>("menu-event", (event) => {
      if (event.payload === "open-theme") {
        setShowThemeModal(true);
      } else if (event.payload === "open-ai-settings") {
        setShowAiSettings(true);
      } else if (event.payload === "new-tab") {
        addTab();
      }
    }).then(fn => { unlistenMenu = fn; }).catch(() => {});

    listen<string[]>("sentinel-url", (event) => {
      const actions = UrlSchemeHandler.getInstance().parseMany(event.payload);
      for (const action of actions) {
        if (action.type === 'new-tab') {
          addTab(action.path);
        } else if ((action.type === 'open' || action.type === 'workspace') && action.path) {
          addTab(action.path);
        }
      }
    }).then(fn => { unlistenUrl = fn; }).catch(() => {});

    return () => { 
      if (unlistenMenu) unlistenMenu(); 
      if (unlistenUrl) unlistenUrl();
    };
  }, [addTab]);

  const closeTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      const newId = getUniqueId('tab');
      const newPane = createTerminalPane();
      setPanePaths({ [newPane.data.id]: '~' });
      setTabs([{ id: newId, name: 'Terminal 1', rootPane: newPane }]);
      setActiveTabId(newId);
      setActivePaneId(newPane.data.id);
    } else {
      if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      setTabs(newTabs);
    }
  };

  const handleSessionCreated = (paneId: string, sessionId: string) => {
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const updateSessionRecursive = (node: PaneNode): PaneNode => {
        if (node.type === 'terminal') {
          if (node.data.id === paneId) {
            return { ...node, data: { ...node.data, sessionId } };
          }
          return node;
        } else if (node.type === 'split') {
          return {
            ...node,
            data: {
              ...node.data,
              pane1: updateSessionRecursive(node.data.pane1),
              pane2: updateSessionRecursive(node.data.pane2)
            }
          };
        }
        return node;
      };
      return {
        ...tab,
        rootPane: updateSessionRecursive(tab.rootPane)
      };
    }));
  };

  const splitPane = (paneId: string, direction: SplitDirection) => {
    const newTerminal = createTerminalPane();
    const newPaneId = newTerminal.data.id;

    // A newly spawned terminal session opens in the default home directory ('~')
    setPanePaths(prev => ({ ...prev, [newPaneId]: '~' }));
    setActivePaneId(newPaneId);

    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const splitRecursive = (node: PaneNode): PaneNode => {
        if (node.type === 'terminal' && node.data.id === paneId) {
          return {
            type: 'split',
            data: {
              id: getUniqueId('split'),
              direction,
              pane1: { type: 'terminal', data: { ...node.data } },
              pane2: newTerminal
            }
          };
        } else if (node.type === 'split') {
          return {
            ...node,
            data: {
              ...node.data,
              pane1: splitRecursive(node.data.pane1),
              pane2: splitRecursive(node.data.pane2)
            }
          };
        }
        return node;
      };
      return {
        ...tab,
        rootPane: splitRecursive(tab.rootPane)
      };
    }));
  };

  const closePane = (paneId: string) => {
    if (activePaneId === paneId) {
      setActivePaneId('');
    }
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const removeRecursive = (node: PaneNode): PaneNode | null => {
        if (node.type === 'terminal') {
          if (node.data.id === paneId) {
            if (node.data.sessionId) {
              try {
                SessionManager.getInstance().kill(node.data.sessionId);
              } catch (err) {
                console.error("Failed to kill session:", err);
              }
            }
            return null;
          }
          return node;
        }
        const left = removeRecursive(node.data.pane1);
        const right = removeRecursive(node.data.pane2);
        if (!left && !right) return null;
        if (!left) return right;
        if (!right) return left;
        return { ...node, data: { ...node.data, pane1: left, pane2: right } };
      };
      const updated = removeRecursive(tab.rootPane);
      return updated ? { ...tab, rootPane: updated } : tab;
    }));
  };

  const getActiveTerminalPane = (root?: PaneNode): { id: string; sessionId?: string } | undefined => {
    if (!root) return undefined;
    const allTerminals: { id: string; sessionId?: string }[] = [];
    const collect = (node: PaneNode) => {
      if (node.type === 'terminal') {
        allTerminals.push(node.data);
      } else {
        collect(node.data.pane1);
        collect(node.data.pane2);
      }
    };
    collect(root);

    if (activePaneId) {
      const match = allTerminals.find(t => t.id === activePaneId);
      if (match) return match;
    }
    return allTerminals[0];
  };

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeTerminal = getActiveTerminalPane(activeTab?.rootPane);
  const currentDisplayPath = activeTerminal ? (panePaths[activeTerminal.id] || '~') : '~';

  const formatDisplayPath = (path?: string): string => {
    if (!path || path === '~' || path.trim() === '') return '~';
    return path.replace(/^(\/Users\/[^\/]+|\/home\/[^\/]+)/, '~');
  };

  const getFolderBasename = (path: string): string => {
    const cleaned = formatDisplayPath(path);
    if (cleaned === '~' || cleaned === '') return '~';
    const parts = cleaned.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : '~';
  };

  const getTabDisplayTitle = (tab: Tab): string => {
    const term = getActiveTerminalPane(tab.rootPane);
    const rawPath = term ? (panePaths[term.id] || '~') : '~';
    const cleaned = formatDisplayPath(rawPath);
    return `${cleaned} — -zsh`;
  };

  useEffect(() => {
    try {
      const basename = getFolderBasename(currentDisplayPath);
      const windowTitle = `📁 ${basename} — -zsh`;
      document.title = windowTitle;
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().setTitle(windowTitle).catch(() => {});
      }).catch(() => {});
    } catch (e) {
      // Ignore in non-Tauri environments
    }
  }, [currentDisplayPath, panePaths]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      try {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setCommandPaletteOpen(true);
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key && e.key.toLowerCase() === 't') {
          e.preventDefault();
          addTab();
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          if (activeTerminal) splitPane(activeTerminal.id, 'vertical');
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          if (activeTerminal) splitPane(activeTerminal.id, 'horizontal');
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (activeTerminal && activeTerminal.sessionId) {
            SessionManager.getInstance().write(activeTerminal.sessionId, 'clear\r');
          }
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key && e.key.toLowerCase() === 'r') {
          e.preventDefault();
          if (activeTerminal && activeTerminal.sessionId) {
            SessionManager.getInstance().write(activeTerminal.sessionId, 'clear && printf "\\033c"\r');
          }
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === ',') {
          e.preventDefault();
          setShowAiSettings(prev => !prev);
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key && e.key.toLowerCase() === 'w') {
          e.preventDefault();
          if (activeTab && activeTerminal) {
            if (activeTab.rootPane.type === 'split') {
              closePane(activeTerminal.id);
            } else if (tabs.length > 1) {
              closeTab(activeTabId, { stopPropagation: () => {} } as any);
            }
          }
          return;
        }
      } catch (err) {
        console.error("Keyboard event error:", err);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, activeTab, activeTerminal, addTab]);

  const handleStatusBarNavigate = (targetPath: string, commandToExecute: string) => {
    if (activeTerminal) {
      setPanePaths(prev => ({ ...prev, [activeTerminal.id]: targetPath }));
      if (activeTerminal.sessionId) {
        SessionManager.getInstance().write(activeTerminal.sessionId, `${commandToExecute}\r`);
      }
    }
  };

  const renderPane = (node: PaneNode, isTabActive: boolean, isRoot: boolean = false): React.JSX.Element => {
    if (node.type === 'terminal') {
      const isSelected = activeTerminal?.id === node.data.id;
      return (
        <div 
          key={node.data.id}
          className="pane-terminal-wrapper" 
          onClick={() => setActivePaneId(node.data.id)}
          style={{ 
            border: isSelected ? '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.35))' : '1px solid var(--sentinel-border, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div className="pane-header-controls">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85, fontSize: '11px', fontWeight: 500 }}>
              <span>📁 {formatDisplayPath(panePaths[node.data.id] || '~')} — -zsh</span>
            </span>
            <div className="pane-action-buttons">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  className="shell-btn"
                  onClick={(e) => { e.stopPropagation(); setActiveShellMenuPaneId(activeShellMenuPaneId === node.data.id ? null : node.data.id); setShowThemeModal(false); }}
                  title="Shell Session & Workspace Actions"
                  style={{
                    background: activeShellMenuPaneId === node.data.id ? 'var(--sentinel-hover, rgba(255, 255, 255, 0.15))' : 'transparent',
                    borderColor: activeShellMenuPaneId === node.data.id ? 'var(--sentinel-border-active, rgba(255, 255, 255, 0.35))' : 'var(--sentinel-border, rgba(255, 255, 255, 0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Shell</span>
                  <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
                </button>
                {activeShellMenuPaneId === node.data.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      width: '240px',
                      background: 'var(--sentinel-modal-bg, rgba(16, 17, 21, 0.98))',
                      border: '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.2))',
                      borderRadius: '8px',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
                      padding: '6px 0',
                      zIndex: 10000,
                      color: 'var(--sentinel-fg, #ffffff)',
                      fontSize: '12px'
                    }}
                  >
                    {[
                      { label: 'New Terminal Tab', shortcut: '⌘T', action: () => addTab() },
                      { label: 'Split Vertically (Side by side)', shortcut: '⌘D', action: () => splitPane(node.data.id, 'vertical') },
                      { label: 'Split Horizontally (Stacked)', shortcut: '⇧⌘D', action: () => splitPane(node.data.id, 'horizontal') },
                      { type: 'divider' },
                      { label: 'Clear Scrollback & Screen', shortcut: '⌘K', action: () => { if (node.data.sessionId) SessionManager.getInstance().write(node.data.sessionId, 'clear\r'); } },
                      { label: 'Reset Shell Session', shortcut: '⌘R', action: () => { if (node.data.sessionId) SessionManager.getInstance().write(node.data.sessionId, 'clear && printf "\\033c"\r'); } },
                      { type: 'divider' },
                      { label: 'AI Command Palette & Prompt', shortcut: '⇧⌘P', action: () => setCommandPaletteOpen(true) },
                      { label: 'Zero-Trust AI Security & Profile', shortcut: '⌘,', action: () => setShowAiSettings(true) },
                      { label: 'macOS Integration & Setup Wizard...', shortcut: '⌘I', action: () => setShowWizard(true) },
                      { type: 'divider' },
                      { label: 'Close Pane / Tab', shortcut: '⌘W', action: () => {
                        if (!isRoot) closePane(node.data.id);
                        else if (tabs.length > 1) closeTab(activeTabId, { stopPropagation: () => {} } as any);
                      }, disabled: isRoot && tabs.length === 1 }
                    ].map((item, idx) => {
                      if ('type' in item && item.type === 'divider') {
                        return <div key={idx} style={{ height: '1px', background: 'var(--sentinel-border, rgba(255, 255, 255, 0.08))', margin: '4px 0' }} />;
                      }
                      const menuItem = item as { label: string; shortcut: string; action: () => void; disabled?: boolean };
                      return (
                        <div
                          key={idx}
                          onClick={() => { if (!menuItem.disabled) { menuItem.action(); setActiveShellMenuPaneId(null); } }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 14px',
                            cursor: menuItem.disabled ? 'default' : 'pointer',
                            opacity: menuItem.disabled ? 0.35 : 0.9,
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => { if (!menuItem.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sentinel-hover, rgba(255, 255, 255, 0.08))'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span>{menuItem.label}</span>
                          <span style={{ fontSize: '11px', opacity: 0.5, fontFamily: 'monospace' }}>{menuItem.shortcut}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button 
                className="personalize-btn"
                onClick={(e) => { e.stopPropagation(); setShowThemeModal(!showThemeModal); setActiveShellMenuPaneId(null); }} 
                title="Personalize Workspace Appearance & Theme"
                style={{
                  background: showThemeModal ? 'var(--sentinel-hover, rgba(255, 255, 255, 0.15))' : 'transparent',
                  borderColor: showThemeModal ? 'var(--sentinel-border-active, rgba(255, 255, 255, 0.35))' : 'var(--sentinel-border, rgba(255, 255, 255, 0.1))'
                }}
              >
                Personalize
              </button>
              <button onClick={(e) => { e.stopPropagation(); splitPane(node.data.id, 'vertical'); }} title="Split Vertically (Side by side)">Split V</button>
              <button onClick={(e) => { e.stopPropagation(); splitPane(node.data.id, 'horizontal'); }} title="Split Horizontally (Stacked)">Split H</button>
              {!isRoot && (
                <button className="pane-close-btn" onClick={(e) => { e.stopPropagation(); closePane(node.data.id); }} title="Close Pane">✕</button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '6px' }}>
            <TerminalView 
              key={node.data.id}
              sessionId={node.data.sessionId}
              isActive={isTabActive}
              currentPath={panePaths[node.data.id] || '~'}
              onPathChange={(p) => setPanePaths(prev => ({ ...prev, [node.data.id]: p }))}
              onSessionCreated={(sessionId) => handleSessionCreated(node.data.id, sessionId)}
            />
          </div>
        </div>
      );
    } else {
      const isVertical = node.data.direction === 'vertical';
      return (
        <div key={node.data.id} className={`split-container ${isVertical ? 'split-vertical' : 'split-horizontal'}`}>
          <div className="split-pane">{renderPane(node.data.pane1, isTabActive, false)}</div>
          <div className="split-divider" />
          <div className="split-pane">{renderPane(node.data.pane2, isTabActive, false)}</div>
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      {tabs.length > 1 && (
        <div className="tabs-bar">
          <div className="tabs-track">
            {tabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <div 
                  key={tab.id} 
                  className={`tab-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="tab-pill-text">
                    {getTabDisplayTitle(tab)}
                  </span>
                  {tabs.length > 1 && (
                    <button className="pill-close-btn" onClick={(e) => closeTab(tab.id, e)} title="Close Tab">✕</button>
                  )}
                </div>
              );
            })}
            <button className="pill-add-btn" onClick={addTab} title="New Terminal Tab">+</button>
          </div>
        </div>
      )}

      {/* Classic Minimalist Workspace Appearance Modal */}
      {showThemeModal && (
        <div style={{
          position: 'absolute',
          top: '72px',
          right: '20px',
          width: '320px',
          background: 'var(--sentinel-modal-bg, rgba(20, 20, 22, 0.97))',
          border: '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.2))',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
          zIndex: 9999,
          color: 'var(--sentinel-fg, #F8FAFC)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--sentinel-border, rgba(255,255,255,0.08))', paddingBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>
              Workspace Appearance
            </h3>
            <button 
              onClick={() => setShowThemeModal(false)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5, cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
            >✕</button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Classic Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {ThemeManager.getInstance().getPresetThemes().map(theme => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => {
                      setSelectedThemeId(theme.id);
                      ThemeManager.getInstance().loadTheme(theme);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--sentinel-hover, rgba(255, 255, 255, 0.12))' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.4))' : '1px solid var(--sentinel-border, rgba(255, 255, 255, 0.07))',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 400, marginBottom: '6px', color: theme.colors.foreground }}>
                      {theme.name}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: theme.colors.background, display: 'inline-block', border: '1px solid rgba(150,150,150,0.3)' }}></span>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: theme.colors.blue, display: 'inline-block', opacity: 0.85 }}></span>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: theme.colors.green, display: 'inline-block', opacity: 0.85 }}></span>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: theme.colors.foreground, display: 'inline-block', opacity: 0.85 }}></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
              <span style={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transparency</span>
              <span style={{ opacity: 0.8 }}>{Math.round(transparency * 100)}%</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: '65%', val: 0.65 },
                { label: '80%', val: 0.82 },
                { label: '90%', val: 0.92 },
                { label: '100%', val: 1.0 }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setTransparency(item.val);
                    ThemeManager.getInstance().updateTransparency(item.val);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    background: transparency === item.val ? 'var(--sentinel-hover, rgba(255, 255, 255, 0.18))' : 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--sentinel-fg, #ffffff)',
                    border: transparency === item.val ? '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.4))' : '1px solid var(--sentinel-border, rgba(255, 255, 255, 0.08))',
                    cursor: 'pointer',
                    fontWeight: transparency === item.val ? 600 : 400,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', fontWeight: 600 }}>
              <span style={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Backdrop Blur</span>
              <span style={{ opacity: 0.8 }}>{blurLevel}px</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: '20px', val: 20 },
                { label: '15px', val: 15 },
                { label: '8px', val: 8 },
                { label: '0px', val: 0 }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setBlurLevel(item.val);
                    ThemeManager.getInstance().updateBlur(item.val);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    background: blurLevel === item.val ? 'var(--sentinel-hover, rgba(255, 255, 255, 0.18))' : 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--sentinel-fg, #ffffff)',
                    border: blurLevel === item.val ? '1px solid var(--sentinel-border-active, rgba(255, 255, 255, 0.4))' : '1px solid var(--sentinel-border, rgba(255, 255, 255, 0.08))',
                    cursor: 'pointer',
                    fontWeight: blurLevel === item.val ? 600 : 400,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="terminal-container">
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            style={{ display: activeTabId === tab.id ? 'flex' : 'none', width: '100%', height: '100%', flex: 1 }}
          >
            {renderPane(tab.rootPane, activeTabId === tab.id, true)}
          </div>
        ))}
      </div>
      <StatusBar 
        currentPath={currentDisplayPath}
        onNavigate={handleStatusBarNavigate}
      />
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
        capabilities={[
          { id: 'open_ai_settings', name: 'Open AI Settings', description: 'Configure local AI models (Ollama, Qwen)' },
          { id: 'personalize', name: 'Personalize UI', description: 'Open color theme and glassmorphic appearance customization' }
        ]}
        onExecuteCapability={(id) => {
          if (id === 'open_ai_settings') {
            setShowAiSettings(true);
          } else if (id === 'personalize') {
            setShowThemeModal(true);
          }
        }}
      />
      {showAiSettings && (
        <div style={{ position: 'absolute', top: '40px', bottom: '28px', left: 0, right: 0, zIndex: 9000 }}>
          <AiSettingsPage />
          <button 
            onClick={() => setShowAiSettings(false)} 
            style={{ 
              position: 'absolute', top: '16px', right: '16px', 
              padding: '8px 16px', backgroundColor: 'var(--sentinel-selection)', 
              color: 'var(--sentinel-fg)', border: 'none', borderRadius: '4px', cursor: 'pointer' 
            }}
          >
            Close Settings
          </button>
        </div>
      )}
      <InstallerWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />
    </div>
  );
}

export default App;
