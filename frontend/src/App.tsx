import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CesiumViewerContainer } from './cesium/CesiumViewerContainer';
import { ArielSidebar } from './components/Navigation/ArielSidebar';
import { SurfaceWorkspace } from './components/Workspaces/SurfaceWorkspace';
import { UnderwaterWorkspace } from './components/Workspaces/UnderwaterWorkspace';
import { ObservationProfileModal } from './components/ObservationModal/ObservationProfileModal';
import { DataManagerView } from './components/Views/DataManagerView';
import { SettingsView } from './components/Views/SettingsView';
import { PublicView } from './components/Views/PublicView';
import { SearchResourcesView } from './components/Views/SearchResourcesView';
import { HazardAssessmentView } from './components/Views/HazardAssessmentView';
import { FisheryAdvisoriesView } from './components/Views/FisheryAdvisoriesView';
import { OceanEngine } from './ocean/OceanEngine';
import { OceanState } from './ocean/OceanState';
import type { OceanMode, ArielPage } from './types/ocean';

export const App: React.FC = () => {
  const [mode, setMode] = useState<OceanMode>('surface');
  const [activePage, setActivePage] = useState<ArielPage>('3d-ocean');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [engine, setEngine] = useState<OceanEngine | null>(null);
  const engineRef = useRef<OceanEngine | null>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setMode(snapshot.mode);
      setActivePage(snapshot.activePage);
      // Auto expand sidebar for non-3D pages so they match screens 3-8
      if (snapshot.activePage !== '3d-ocean') {
        setSidebarCollapsed(false);
      }
    });
    return unsub;
  }, []);

  const handleEngineReady = useCallback((eng: OceanEngine) => {
    engineRef.current = eng;
    setEngine(eng);
  }, []);

  const handleResetView = () => {
    if (engineRef.current) {
      engineRef.current.resetView();
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="ariel-app-shell">
      {/* 
        3D Geospatial Digital Ocean Engine (Cesium Viewer)
        CRITICAL: Kept mounted at z-index 0 at all times.
        Never unmounted, never reset, never replaced with a mock image.
      */}
      <CesiumViewerContainer onEngineReady={handleEngineReady} />

      {/* Main UI Overlay Layer */}
      <div className="ariel-ui-overlay">
        {/* Left Persistent Navigation Sidebar */}
        <ArielSidebar
          collapsed={activePage === '3d-ocean' ? sidebarCollapsed : false}
          onToggleCollapse={activePage === '3d-ocean' ? toggleSidebar : undefined}
        />

        {/* View Content Area */}
        <main
          className={`ariel-main-content ${
            activePage === '3d-ocean' && sidebarCollapsed ? 'content-full' : ''
          } ${activePage === 'hazard' ? 'hazard-mode' : ''} ${
            activePage === 'fishery' ? 'fishery-mode' : ''
          }`}
        >
          {activePage === '3d-ocean' && (
            mode === 'surface' ? (
              <SurfaceWorkspace onResetView={handleResetView} onToggleSidebar={toggleSidebar} />
            ) : (
              <UnderwaterWorkspace onResetView={handleResetView} />
            )
          )}

          {activePage === 'public-view' && <PublicView />}
          {activePage === 'data-manager' && <DataManagerView />}
          {activePage === 'settings' && <SettingsView />}
          {activePage === 'search' && <SearchResourcesView />}
          {activePage === 'hazard' && <HazardAssessmentView engine={engine} />}
          {activePage === 'fishery' && <FisheryAdvisoriesView engine={engine} />}
        </main>
      </div>

      {/* Webpage 2 — Observation Profile Modal (Model vs Glider vs Argo) */}
      <ObservationProfileModal />
    </div>
  );
};

export default App;
