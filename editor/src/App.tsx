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

function ProfileEditor({ profileId }: { profileId: string }) {
  const { buttons, error, mutationError, saving, createButton, updateButton, moveButton, deleteButton } = useButtons(profileId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewButton, setPreviewButton] = useState<ButtonData | null>(null);
  const [newButton, setNewButton] = useState<ButtonData | null>(null);

  function handleDeselect() {
    setSelectedId(null);
    setNewButton(null);
    setPreviewButton(null);
  }

  function handleSelect(id: string) {
    handleDeselect();
    if (selectedId !== id) setSelectedId(id);
  }

  function handleCreatePrompt(gridPosition: number) {
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
      <div className="flex-1 flex overflow-hidden" onClick={handleDeselect} inert={saving} aria-busy={saving}>
        <ButtonGrid
          buttons={displayedButtons}
          selectedId={selectedId}
          draftButton={newButton && (previewButton ?? newButton)}
          onSelect={handleSelect}
          onMove={moveButton}
          onCreate={handleCreatePrompt}
        />
        <PropertyPanel
          button={selectedButton}
          isNew={!!newButton}
          onPreview={setPreviewButton}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCancel={handleDeselect}
        />
      </div>
    </>
  );
}

function App() {
  const { profiles, activeProfileId, loading, error, createProfile, updateProfile, deleteProfile, switchProfile } = useProfiles();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateProfile = async (name: string) => {
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
          onSwitchProfile={switchProfile}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          onDeleteProfile={deleteProfile}
        />
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Connecting to server...</div>
        ) : activeProfileId ? (
          <ProfileEditor key={activeProfileId} profileId={activeProfileId} />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-amber-500" role="alert">{error}</div>
        ) : (
          <>
            <EmptyProfileState onCreateProfile={() => setIsCreateDialogOpen(true)} />
            <CreateProfileDialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onCreate={handleCreateProfile}
            />
          </>
        )}
      </div>
    </Tooltip.Provider>
  );
}

export default App;
