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

export const UnderwaterWorkspace: React.FC<
  UnderwaterWorkspaceProps
> = ({ onResetView }) => {
  const [activeRegion, setActiveRegion] =
    useState<UnderwaterRegionId | null>(null);

  const [selectedDomain, setSelectedDomain] =
    useState<
      'indian-ocean' | 'southern-ocean' | null
    >(null);

  useEffect(() => {
    const unsub =
      OceanState.getInstance().subscribe(
        (snapshot) => {
          setActiveRegion(
            snapshot.underwaterRegion,
          );

          setSelectedDomain(
            snapshot.selectedOceanDomain,
          );
        },
      );

    return unsub;
  }, []);

  return (
    <div className="underwater-workspace-root">
      {/* Top Header with Stratum & Variable Selector */}
      <UnderwaterHeader
        onResetView={onResetView}
      />

      {/* Indian Ocean sea-selection popup */}
      {activeRegion === null &&
        selectedDomain === 'indian-ocean' && (
          <UnderwaterRegionOverview />
        )}

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

export default UnderwaterWorkspace;