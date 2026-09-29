import React from 'react';
import { HeaderControls } from '../Header/HeaderControls';
import { VisualizationControlsPanel } from '../OceanControls/VisualizationControlsPanel';
import { DataInstrumentsPanel } from '../OceanControls/DataInstrumentsPanel';
import { OceanBottomBar } from '../OceanControls/OceanBottomBar';
import { ContextualCompass } from '../OceanControls/ContextualCompass';

interface SurfaceWorkspaceProps {
  onResetView?: () => void;
  onToggleSidebar?: () => void;
}

export const SurfaceWorkspace: React.FC<SurfaceWorkspaceProps> = ({
  onResetView,
  onToggleSidebar,
}) => {
  return (
    <div className="ocean-operational-layout">
      <HeaderControls onResetView={onResetView} onToggleSidebar={onToggleSidebar} />
      <ContextualCompass />
      <div className="ocean-workspace-panels">
        <VisualizationControlsPanel />
        <DataInstrumentsPanel />
      </div>
      <OceanBottomBar />
    </div>
  );
};
