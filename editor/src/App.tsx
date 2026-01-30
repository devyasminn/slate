import { useState, useCallback, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useButtons } from './hooks/useButtons';
import { useProfiles } from './hooks/useProfiles';
import { Header } from './components/Header/Header';
import { ButtonGrid } from './components/ButtonGrid/ButtonGrid';
import { PropertyPanel } from './components/PropertyPanel/PropertyPanel';
import type { ButtonData } from './types/button';
import { createButton } from './services/api';
import { EmptyProfileState } from './components/EmptyProfileState/EmptyProfileState';
import { CreateProfileDialog } from './components/CreateProfileDialog/CreateProfileDialog';

function App() {
  const { profiles, activeProfileId, loading: profilesLoading, createProfile, updateProfile, deleteProfile, switchProfile } = useProfiles();
  const { buttons, loading: buttonsLoading, error, updateButton, reorderButtons, deleteButton, loadButtons } = useButtons(activeProfileId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewButton, setPreviewButton] = useState<ButtonData | null>(null);
  const [newButton, setNewButton] = useState<ButtonData | null>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const selectedButton = newButton || buttons.find(b => b.id === selectedId) || null;
  const loading = profilesLoading || buttonsLoading;

  const handleCreateProfile = async (name: string) => {
    try {
      const newProfile = await createProfile(name);
      await switchProfile(newProfile.id);
      setIsCreateDialogOpen(false);
    } catch (e) {
      console.error('Failed to create profile:', e);
    }
  };

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    setNewButton(null);
    setPreviewButton(null);
  }, []);

  useEffect(() => {
    setPreviewButton(null);
    if (selectedId) {
      setNewButton(null);
    }
  }, [selectedId]);

  useEffect(() => {
    handleDeselect();
  }, [activeProfileId, handleDeselect]);

  const displayedButtons = (() => {
    const result = buttons.map(b => {
      if (previewButton && b.id === previewButton.id) {
        return previewButton;
      }
      return b;
    });
    if (newButton) {
      result.push(newButton);
    }
    return result;
  })();

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleCreatePrompt = useCallback(() => {
    setSelectedId(null);

    const tempId = `new-${Date.now()}`;
    setNewButton({
      id: tempId,
      label: 'New Button',
      actionType: 'OPEN_URL',
      actionPayload: { url: 'https://' },
      background: '',
      icon: '',
      iconColor: '#ffffff'
    });
  }, []);

  const handlePreview = useCallback((button: ButtonData) => {
    if (newButton && button.id === newButton.id) {
      setNewButton(button);
    } else {
      setPreviewButton(button);
    }
  }, [newButton]);

  const handleUpdate = useCallback(async (button: ButtonData) => {
    try {
      if (newButton && button.id === newButton.id) {
        await createButton(button, activeProfileId || undefined);
        await loadButtons();
        setNewButton(null);
        setSelectedId(button.id);
      } else {
        await updateButton(button);
        setPreviewButton(null);
      }
    } catch (e) {
      console.error('Failed to update/create button:', e);
    }
  }, [updateButton, newButton, loadButtons, activeProfileId]);

  const handleReorder = useCallback(async (newButtons: ButtonData[]) => {
    try {
      await reorderButtons(newButtons);
    } catch (e) {
      console.error('Failed to reorder buttons:', e);
    }
  }, [reorderButtons]);

  const handleDelete = useCallback(async (buttonId: string) => {
    if (newButton && buttonId === newButton.id) {
      setNewButton(null);
      return;
    }

    try {
      await deleteButton(buttonId);
      setSelectedId(null);
    } catch (e) {
      console.error('Failed to delete button:', e);
    }
  }, [deleteButton, newButton]);



  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <Header
          profiles={[]}
          activeProfileId={null}
          onSwitchProfile={() => { }}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          onDeleteProfile={deleteProfile}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <span>Connecting to server...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <Header
          profiles={[]}
          activeProfileId={null}
          onSwitchProfile={() => { }}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          onDeleteProfile={deleteProfile}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-amber-500">
          <span>⚠️ {error}</span>
          <p className="text-sm text-gray-400">Make sure the Slate server is running.</p>
        </div>
      </div>
    );
  }

  // Show empty state if no profiles exist
  if (profiles.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <Header
          profiles={[]}
          activeProfileId={null}
          onSwitchProfile={() => { }}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          onDeleteProfile={deleteProfile}
        />
        <EmptyProfileState onCreateProfile={() => setIsCreateDialogOpen(true)} />
        <CreateProfileDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreate={handleCreateProfile}
        />
      </div>
    );
  }

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
        <div className="flex-1 flex overflow-hidden" onClick={handleDeselect}>
          <ButtonGrid
            buttons={displayedButtons}
            selectedId={selectedId}
            previewButtonId={newButton?.id}
            onSelect={handleSelect}
            onReorder={handleReorder}
            onCreate={handleCreatePrompt}
          />
          <PropertyPanel
            button={selectedButton}
            isNew={!!newButton}
            onPreview={handlePreview}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onCancel={handleDeselect}
          />
        </div>
      </div>
    </Tooltip.Provider>
  );
}

export default App;
