import './ButtonGrid.css';
import { ActionButton } from '../ActionButton/ActionButton';
import { MonitorButton } from '../MonitorButton/MonitorButton';
import type { Button, ActionResultPayload, SystemStatsPayload } from '../../types';

interface ButtonGridProps {
  buttons: Button[];
  lastResult: ActionResultPayload | null;
  systemStats: SystemStatsPayload | null;
  showLabels: boolean;
  onButtonPress: (buttonId: string) => void;
}

/** Action types that are display-only (system monitoring) */
const MONITOR_ACTION_TYPES = ['SYSTEM_CPU', 'SYSTEM_RAM', 'SYSTEM_GPU'];

function getMonitorValue(actionType: string, stats: SystemStatsPayload | null): number | null {
  if (!stats) return null;

  switch (actionType) {
    case 'SYSTEM_CPU':
      return stats.cpu;
    case 'SYSTEM_RAM':
      return stats.ram;
    case 'SYSTEM_GPU':
      return stats.gpu;
    default:
      return null;
  }
}

export function ButtonGrid({ buttons, lastResult, systemStats, showLabels, onButtonPress }: ButtonGridProps) {
  const TOTAL_SLOTS = 32;

  const gridSlots = Array.from({ length: TOTAL_SLOTS }, (_, index) => {
    const button = buttons[index];
    return { index, button };
  });

  return (
    <div className="w-full flex justify-center overflow-x-auto pb-5">
      <div className="button-grid">
        {gridSlots.map(({ index, button }) => {
          if (!button) {
            return (
              <ActionButton
                key={`empty-${index}`}
                variant="empty"
              />
            );
          }

          if (MONITOR_ACTION_TYPES.includes(button.actionType)) {
            return (
              <MonitorButton
                key={button.id}
                button={button}
                value={getMonitorValue(button.actionType, systemStats)}
              />
            );
          }

          return (
            <ActionButton
              key={button.id}
              button={button}
              showLabel={showLabels}
              isSuccess={lastResult?.buttonId === button.id && lastResult?.status === 'success'}
              isError={lastResult?.buttonId === button.id && lastResult?.status === 'error'}
              onPress={() => onButtonPress(button.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
