import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import { UnderwaterHeader } from '../Underwater/UnderwaterHeader';
import { DepthNavigator } from '../Underwater/DepthNavigator';
import { WaterColumn } from '../Underwater/WaterColumn';
import { UnderwaterAnalysisBar } from '../Underwater/UnderwaterAnalysisBar';
import { UnderwaterLegend } from '../Underwater/UnderwaterLegend';
import { UnderwaterObservationPanel } from '../Underwater/UnderwaterObservationPanel';
import { UnderwaterRegionOverview } from '../Underwater/UnderwaterRegionOverview';
import type { UnderwaterRegionId } from '../../types/ocean';

interface UnderwaterWorkspaceProps {
  onResetView?: () => void;
}

export const UnderwaterWorkspace: React.FC<UnderwaterWorkspaceProps> = ({ onResetView }) => {
  const [activeRegion, setActiveRegion] = useState<UnderwaterRegionId | null>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setActiveRegion(snapshot.underwaterRegion);
    });
    return unsub;
  }, []);

  return (
    <div className="underwater-workspace-root">
      {/* Top Header with Stratum & Variable Selector */}
      <UnderwaterHeader onResetView={onResetView} />

      {/* When entering Underwater mode or in overview, show 4-region selection overview */}
      {activeRegion === null && <UnderwaterRegionOverview />}

      {/* Top Center Oceanographic Analysis Telemetry Bar */}
      <UnderwaterAnalysisBar />

      {/* Left Column: Water Column Profile Checkpoints */}
      <WaterColumn />

      {/* Right Column: Vertical Depth Navigator */}
      <DepthNavigator />

      {/* Bottom Left: In-situ Argo & Glider Observatories */}
      <UnderwaterObservationPanel />

      {/* Bottom Center / Right: Dynamic Scalar Gradient Legend */}
      <UnderwaterLegend />
    </div>
  );
};
