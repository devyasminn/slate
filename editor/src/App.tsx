import { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useButtons } from './hooks/useButtons';
import { useProfiles } from './hooks/useProfiles';
import { Header } from './components/Header/Header';
import { ButtonGrid } from './components/ButtonGrid/ButtonGrid';
import { PropertyPanel } from './components/PropertyPanel/PropertyPanel';
import type { ButtonData } from './types/button';
import { EmptyProfileState } from './components/EmptyProfileState/EmptyProfileState';
import { CreateProfileDialog } from './components/CreateProfileDialog/CreateProfileDialog';
import type { ButtonStyle } from './domain/buttonMutations';
import { cloneButtonToPosition, snapshotButton } from './domain/buttonClipboard';
import { getNextAvailablePosition } from './domain/buttonGrid';
import { ConfirmDialog } from './components/ConfirmDialog/ConfirmDialog';

function ProfileEditor({ profileId, copiedStyle, onCopyStyle, copiedButton, onCopyButton, onPendingChange, requestNavigation }: {
  profileId: string;
  copiedStyle: ButtonStyle | null;
  onCopyStyle: (style: ButtonStyle) => void;
  copiedButton: ButtonData | null;
  onCopyButton: (button: ButtonData) => void;
  onPendingChange: (pending: boolean) => void;
  requestNavigation: (action: () => void) => void;
}) {
  const { buttons, error, mutationError, saving, createButton, updateButton, moveButton, deleteButton } = useButtons(profileId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewButton, setPreviewButton] = useState<ButtonData | null>(null);
  const [newButton, setNewButton] = useState<ButtonData | null>(null);

  function handleDeselect() {
    onPendingChange(false);
    setSelectedId(null);
    setNewButton(null);
    setPreviewButton(null);
  }

  function handleSelect(id: string) {
    if (selectedId === id) return;
    requestNavigation(() => {
      handleDeselect();
      setSelectedId(id);
    });
  }

  function handleCreatePrompt(gridPosition: number) {
    if (newButton?.gridPosition === gridPosition) return;
    requestNavigation(() => {
      handleDeselect();
      setNewButton({
        id: `new-${Date.now()}`,
        gridPosition,
        label: 'New Button',
        actionType: 'OPEN_URL',
        actionPayload: { url: 'https://' },
        background: '',
        icon: '',
        iconColor: '#ffffff',
      });
    });
  }

  async function handleUpdate(button: ButtonData) {
    if (newButton) {
      if (!await createButton(button)) return false;
      setNewButton(null);
      setSelectedId(button.id);
    } else if (!await updateButton(button)) {
      return false;
    }
    setPreviewButton(null);
    return true;
  }

  async function handleDelete(buttonId: string) {
    if (await deleteButton(buttonId)) handleDeselect();
  }

  async function createCopy(source: ButtonData, position: number) {
    const copy = cloneButtonToPosition(source, position);
    requestNavigation(() => {
      handleDeselect();
      void (async () => {
        if (!await createButton(copy)) return;
        setNewButton(null);
        setPreviewButton(null);
        setSelectedId(copy.id);
      })();
    });
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-amber-500" role="alert">{error}</div>;
  }
  if (!buttons) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading buttons...</div>;
  }

  const selectedButton = newButton ?? buttons.find(button => button.id === selectedId) ?? null;
  const displayedButtons = buttons.map(button => previewButton?.id === button.id
    ? { ...previewButton, gridPosition: button.gridPosition }
    : button);

  return (
    <>
      {mutationError && <p className="px-8 pt-2 text-sm text-amber-500" role="alert">{mutationError}</p>}
      <div className="flex-1 flex overflow-hidden" inert={saving} aria-busy={saving}>
        <ButtonGrid
          buttons={displayedButtons}
          selectedId={selectedId}
          draftButton={newButton && (previewButton ?? newButton)}
          onSelect={handleSelect}
          onMove={moveButton}
          onCreate={handleCreatePrompt}
          canPaste={!!copiedButton}
          onCopy={button => onCopyButton(snapshotButton(button))}
          onDuplicate={button => {
            const occupiedButtons = newButton ? [...buttons, newButton] : buttons;
            const position = getNextAvailablePosition(occupiedButtons, button.gridPosition);
            if (position !== null) void createCopy(button, position);
          }}
          canDuplicate={button => getNextAvailablePosition(newButton ? [...buttons, newButton] : buttons, button.gridPosition) !== null}
          onPaste={position => { if (copiedButton) void createCopy(copiedButton, position); }}
        />
        <PropertyPanel
          button={selectedButton}
          isNew={!!newButton}
          onPreview={setPreviewButton}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCancel={handleDeselect}
          onPendingChange={onPendingChange}
          copiedStyle={copiedStyle}
          onCopyStyle={onCopyStyle}
        />
      </div>
    </>
  );
}

function App() {
  const { profiles, activeProfileId, loading, error, createProfile, updateProfile, deleteProfile, switchProfile } = useProfiles();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<ButtonStyle | null>(null);
  const [copiedButton, setCopiedButton] = useState<ButtonData | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  function requestNavigation(action: () => void) {
    if (hasPendingChanges) setPendingNavigation(() => action);
    else {
      setHasPendingChanges(false);
      action();
    }
  }

  function confirmNavigation() {
    const action = pendingNavigation;
    setPendingNavigation(null);
    setHasPendingChanges(false);
    action?.();
  }

  const handleCreateFirstProfile = async (name: string) => {
    try {
      const newProfile = await createProfile(name);
      await switchProfile(newProfile.id);
      setIsCreateDialogOpen(false);
    } catch (e) {
      console.error('Failed to create profile:', e);
    }
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="h-full flex flex-col">
        <Header
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSwitchProfile={profileId => {
            if (profileId !== activeProfileId) requestNavigation(() => { void switchProfile(profileId); });
          }}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          onDeleteProfile={deleteProfile}
        />
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Connecting to server...</div>
        ) : activeProfileId ? (
          <ProfileEditor key={activeProfileId} profileId={activeProfileId} copiedStyle={copiedStyle} onCopyStyle={setCopiedStyle}
            copiedButton={copiedButton} onCopyButton={setCopiedButton} onPendingChange={setHasPendingChanges} requestNavigation={requestNavigation} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-amber-500" role="alert">{error}</div>
        ) : (
          <>
            <EmptyProfileState onCreateProfile={() => setIsCreateDialogOpen(true)} />
            <CreateProfileDialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onCreate={handleCreateFirstProfile}
            />
          </>
        )}
        <ConfirmDialog
          open={pendingNavigation !== null}
          onOpenChange={open => { if (!open) setPendingNavigation(null); }}
          title="Discard changes?"
          description="You have unsaved changes to this button. Discard them and continue?"
          cancelLabel="Keep Editing"
          confirmLabel="Discard Changes"
          onConfirm={confirmNavigation}
        />
      </div>
    </Tooltip.Provider>
  );
}

export default App;
