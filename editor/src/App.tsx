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
import type { ProfileData } from './types/profile';
import { exportProfile, previewProfileImport, type ProfileImportPreview } from './services/api';
import { openProfileFile, saveProfileFile } from './services/profileFiles';

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
  const { profiles, activeProfileId, loading, error, createProfile, importProfile, updateProfile, deleteProfile, switchProfile } = useProfiles();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<ButtonStyle | null>(null);
  const [copiedButton, setCopiedButton] = useState<ButtonData | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [importPreview, setImportPreview] = useState<(ProfileImportPreview & { contents: string }) | null>(null);
  const [exportTarget, setExportTarget] = useState<ProfileData | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  function requestNavigation(action: () => void) {
    if (hasPendingChanges) setPendingNavigation(() => action);
    else action();
  }

  function confirmNavigation() {
    const action = pendingNavigation;
    setPendingNavigation(null);
    action?.();
  }

  async function runProfileOperation(operation: () => Promise<void>, fallback: string) {
    setProfileBusy(true);
    setProfileError(null);
    try {
      await operation();
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : typeof e === 'string' ? e : fallback);
    } finally {
      setProfileBusy(false);
    }
  }

  function changeProfile(operation: () => Promise<void>, fallback: string) {
    requestNavigation(() => {
      void runProfileOperation(async () => {
        await operation();
        setHasPendingChanges(false);
      }, fallback);
    });
  }

  function chooseImportFile() {
    void runProfileOperation(async () => {
      const contents = await openProfileFile();
      if (contents === null) return;
      const preview = await previewProfileImport(contents);
      setImportPreview({ ...preview, contents });
    }, 'Failed to open profile.');
  }

  function saveExport(profile: ProfileData) {
    void runProfileOperation(async () => {
      const contents = await exportProfile(profile.id);
      await saveProfileFile(profile.name, contents);
    }, 'Failed to export profile.');
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="h-full flex flex-col" inert={profileBusy} aria-busy={profileBusy}>
        <Header
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSwitchProfile={profileId => {
            if (profileId !== activeProfileId) changeProfile(() => switchProfile(profileId), 'Failed to switch profile.');
          }}
          onCreateProfile={() => setIsCreateDialogOpen(true)}
          onImportProfile={chooseImportFile}
          onExportProfile={profile => {
            if (hasPendingChanges) setExportTarget(profile);
            else saveExport(profile);
          }}
          onUpdateProfile={updateProfile}
          onDeleteProfile={async id => {
            await deleteProfile(id);
            if (id === activeProfileId) setHasPendingChanges(false);
          }}
        />
        {profileError && <p className="px-8 pt-2 text-sm text-amber-500" role="alert">{profileError}</p>}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Connecting to server...</div>
        ) : activeProfileId ? (
          <ProfileEditor key={activeProfileId} profileId={activeProfileId} copiedStyle={copiedStyle} onCopyStyle={setCopiedStyle}
            copiedButton={copiedButton} onCopyButton={setCopiedButton} onPendingChange={setHasPendingChanges} requestNavigation={requestNavigation} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-amber-500" role="alert">{error}</div>
        ) : (
          <EmptyProfileState onCreateProfile={() => setIsCreateDialogOpen(true)} />
        )}
      </div>
      <CreateProfileDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={name => changeProfile(() => createProfile(name), 'Failed to create profile.')}
      />
      <ConfirmDialog
        open={importPreview !== null}
        onOpenChange={open => { if (!open) setImportPreview(null); }}
        title="Import Profile"
        description={importPreview
          ? `“${importPreview.name}” contains ${importPreview.buttonCount} ${importPreview.buttonCount === 1 ? 'button' : 'buttons'}. Importing creates a new profile. App and folder paths may need updating on this computer.`
          : ''}
        confirmLabel="Import Profile"
        onConfirm={() => {
          if (importPreview) changeProfile(() => importProfile(importPreview.contents), 'Failed to import profile.');
        }}
      />
      <ConfirmDialog
        open={exportTarget !== null}
        onOpenChange={open => { if (!open) setExportTarget(null); }}
        title="Export Profile"
        description="The export contains the last saved configuration. Your unsaved button changes will stay in the editor."
        confirmLabel="Export Profile"
        onConfirm={() => { if (exportTarget) saveExport(exportTarget); }}
      />
      <ConfirmDialog
        open={pendingNavigation !== null}
        onOpenChange={open => { if (!open) setPendingNavigation(null); }}
        title="Discard changes?"
        description="Your unsaved changes to this button will be lost."
        cancelLabel="Keep Editing"
        confirmLabel="Discard Changes"
        onConfirm={confirmNavigation}
        variant="danger"
      />
    </Tooltip.Provider>
  );
}

export default App;
