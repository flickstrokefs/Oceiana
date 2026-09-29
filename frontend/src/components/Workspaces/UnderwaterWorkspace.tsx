import React from 'react';

import { UnderwaterHeader } from '../Underwater/UnderwaterHeader';
import { DepthNavigator } from '../Underwater/DepthNavigator';
import { WaterColumn } from '../Underwater/WaterColumn';
import { UnderwaterAnalysisBar } from '../Underwater/UnderwaterAnalysisBar';
import { UnderwaterLegend } from '../Underwater/UnderwaterLegend';
import { UnderwaterObservationPanel } from '../Underwater/UnderwaterObservationPanel';
import { ContextualCompass } from '../OceanControls/ContextualCompass';

interface UnderwaterWorkspaceProps {
  onResetView?: () => void;
}

export const UnderwaterWorkspace: React.FC<
  UnderwaterWorkspaceProps
> = ({ onResetView }) => {
  return (
    <div className="underwater-workspace-root">
      <UnderwaterHeader
        onResetView={onResetView}
      />

      <ContextualCompass />

      <UnderwaterAnalysisBar />

      <WaterColumn />

      <DepthNavigator />

      <UnderwaterObservationPanel />

      <UnderwaterLegend />
    </div>
  );
};

export default UnderwaterWorkspace;