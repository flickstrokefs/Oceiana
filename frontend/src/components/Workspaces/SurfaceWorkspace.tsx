import React from 'react';
import { HeaderControls } from '../Header/HeaderControls';
import { OceanControls } from '../OceanControls/OceanControls';

interface SurfaceWorkspaceProps {
  onResetView?: () => void;
}

export const SurfaceWorkspace: React.FC<SurfaceWorkspaceProps> = ({ onResetView }) => {
  return (
    <>
      <HeaderControls onResetView={onResetView} />
      <OceanControls />
    </>
  );
};
