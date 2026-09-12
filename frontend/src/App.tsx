import React, { useEffect, useState, useRef } from 'react';
import { CesiumViewerContainer } from './cesium/CesiumViewerContainer';
import { SurfaceWorkspace } from './components/Workspaces/SurfaceWorkspace';
import { UnderwaterWorkspace } from './components/Workspaces/UnderwaterWorkspace';
import { ObservationModal } from './components/ObservationModal/ObservationModal';
import { OceanEngine } from './ocean/OceanEngine';
import { OceanState } from './ocean/OceanState';
import type { OceanMode } from './types/ocean';

export const App: React.FC = () => {
  const [mode, setMode] = useState<OceanMode>('surface');
  const engineRef = useRef<OceanEngine | null>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setMode(snapshot.mode);
    });
    return unsub;
  }, []);

  const handleResetView = () => {
    if (engineRef.current) {
      engineRef.current.resetView();
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Geospatial Digital Ocean Engine (Shared Cesium Viewer) */}
      <CesiumViewerContainer
        onEngineReady={(engine) => {
          engineRef.current = engine;
        }}
      />

      {/* Mode-based Workspace Split */}
      {mode === 'surface' ? (
        <SurfaceWorkspace onResetView={handleResetView} />
      ) : (
        <UnderwaterWorkspace onResetView={handleResetView} />
      )}

      {/* Shared Observation Profile (Webpage 2) — modal over live Cesium globe */}
      <ObservationModal />
    </div>
  );
};

export default App;
