import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { ButtonGrid } from './components/ButtonGrid/ButtonGrid';
import { ConnectionIndicator } from './components/ConnectionIndicator/ConnectionIndicator';
import { ConnectPrompt } from './components/ConnectPrompt/ConnectPrompt';
import { SettingsMenu } from './components/SettingsMenu/SettingsMenu';
import './App.css';


function App() {
  const { status, authStatus, buttons, profiles, activeProfileId, lastResult, systemStats, sendButtonPress, switchProfile } = useWebSocket();
  const [showLabels, setShowLabels] = useState(() => localStorage.getItem('slate-show-labels') === 'true');
  const [zenMode, setZenMode] = useState(() => localStorage.getItem('slate-zen-mode') === 'true');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const zenTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('slate-show-labels', String(showLabels));
  }, [showLabels]);

  useEffect(() => {
    localStorage.setItem('slate-zen-mode', String(zenMode));
    if (!zenMode) {
      setHeaderVisible(true);
    }
  }, [zenMode]);

  useEffect(() => {
    if (!zenMode || !headerVisible || isMenuOpen) return;

    zenTimerRef.current = window.setTimeout(() => {
      setHeaderVisible(false);
    }, 5000);

    return () => {
      if (zenTimerRef.current) {
        clearTimeout(zenTimerRef.current);
      }
    };
  }, [zenMode, headerVisible, isMenuOpen]);

  const renderContent = () => {
    if (status !== 'connected') {
      return (
        <div className="text-center text-[color:var(--color-text-secondary)] text-base">
          <p>Connecting to server...</p>
        </div>
      );
    }

    if (authStatus === 'pending') {
      return (
        <div className="text-center text-[color:var(--color-text-secondary)] text-base">
          <p>Authenticating...</p>
        </div>
      );
    }

    if (authStatus === 'unauthenticated') {
      return <ConnectPrompt />;
    }

    return (
      <ButtonGrid
        buttons={buttons}
        lastResult={lastResult}
        systemStats={systemStats}
        showLabels={showLabels}
        onButtonPress={sendButtonPress}
      />
    );
  };

  return (
    <div className="flex flex-col min-h-full">
      {zenMode && !headerVisible && (
        <div
          className="zen-touch-zone"
          onClick={() => setHeaderVisible(true)}
          onMouseEnter={() => setHeaderVisible(true)}
        />
      )}
      <header className={`flex justify-center items-center py-4 px-5 relative ${zenMode ? 'zen-header' : ''} ${!headerVisible ? 'header-hidden' : ''}`}>


        <div className="flex items-center gap-2.5">
          <div className="app-logo" aria-hidden="true" />
          <h1 className="app-title">Slate</h1>
        </div>

        <div className="flex items-center gap-2 absolute right-5">
          <ConnectionIndicator status={status} />
          {authStatus === 'authenticated' && (
            <SettingsMenu
              showLabels={showLabels}
              onToggleLabels={setShowLabels}
              zenMode={zenMode}
              onToggleZenMode={setZenMode}
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSwitchProfile={switchProfile}
              onOpenChange={setIsMenuOpen}
            />
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-5">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
