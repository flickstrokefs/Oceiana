import React, { useRef } from 'react';
import { CesiumViewerContainer } from './cesium/CesiumViewerContainer';
import { HeaderControls } from './components/Header/HeaderControls';
import { OceanControls } from './components/OceanControls/OceanControls';
import { ObservationModal } from './components/ObservationModal/ObservationModal';
import { OceanEngine } from './ocean/OceanEngine';

export const App: React.FC = () => {
  const engineRef = useRef<OceanEngine | null>(null);

  const handleResetView = () => {
    if (engineRef.current) {
      engineRef.current.resetView();
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Geospatial Digital Ocean Engine */}
      <CesiumViewerContainer
        onEngineReady={(engine) => {
          engineRef.current = engine;
        }}
      />

      {/* Floating Scientific Controls */}
      <HeaderControls onResetView={handleResetView} />
      <OceanControls />
      <ObservationModal />
    </div>
  );
};

export default App;
