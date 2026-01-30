import './ActionButton.css';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { resolveIcon, fallbackIcon, successIcon, errorIcon } from '../../config/icons';
import type { Button } from '../../types';

interface ActionButtonProps {
  button?: Button;
  variant?: 'default' | 'empty';
  showLabel?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  onPress?: () => void;
}

export function ActionButton({
  button,
  variant = 'default',
  showLabel = false,
  isSuccess = false,
  isError = false,
  onPress
}: ActionButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  if (variant === 'empty') {
    return <div className="action-button empty" />;
  }

  const icon = button ? resolveIcon(button.icon) : fallbackIcon;

  let stateClass = '';
  let stateIcon = null;

  if (isSuccess) {
    stateClass = 'success';
    stateIcon = successIcon;
  } else if (isError) {
    stateClass = 'error';
    stateIcon = errorIcon;
  } else if (isPressed) {
    stateClass = 'pressed';
  }

  const handlePointerDown = () => setIsPressed(true);
  const handlePointerUp = () => {
    setIsPressed(false);
    onPress?.();
  };
  const handlePointerLeave = () => setIsPressed(false);

  const customStyle: Record<string, string> = {};
  if (button?.background) {
    customStyle['--button-custom-bg'] = button.background;
  }
  if (button?.iconColor) {
    customStyle['--button-icon-color'] = button.iconColor;
  }

  const hasCustomBg = !!button?.background;

  return (
    <button
      className={`action-button ${stateClass} ${hasCustomBg ? 'has-custom-bg' : ''}`}
      style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      <div className="button-icon">
        <FontAwesomeIcon icon={stateIcon || icon} className="action-icon" />
      </div>
      {showLabel && button?.label && (
        <span className="button-label">{button.label}</span>
      )}
    </button>
  );
}
