import './ConnectionIndicator.css';
import { useState, useEffect, useRef } from 'react';
import type { ConnectionStatus } from '../../types';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnected: 'Disconnected',
};

const TEXT_DISPLAY_DURATION_MS = 4000;

export function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      setIsExpanded(true);
      timeoutRef.current = window.setTimeout(() => {
        setIsExpanded(false);
      }, TEXT_DISPLAY_DURATION_MS);
    } else {
      setIsExpanded(true);
      timeoutRef.current = window.setTimeout(() => {
        setIsExpanded(false);
      }, TEXT_DISPLAY_DURATION_MS);
    }

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [status]);

  const shouldShowText = isExpanded || isHovered;

  return (
    <div
      className={`connection-indicator ${shouldShowText ? '' : 'collapsed'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`status-dot ${status}`} />
      <span className={`status-text ${shouldShowText ? 'expanded' : 'collapsed'}`}>
        {statusLabels[status]}
      </span>
    </div>
  );
}
