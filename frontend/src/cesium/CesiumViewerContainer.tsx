import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { OceanEngine } from '../ocean/OceanEngine';

if (typeof window !== 'undefined' && !(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL) {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/';
}

Cesium.Ion.defaultAccessToken = '';

interface CesiumViewerContainerProps {
  onEngineReady?: (engine: OceanEngine) => void;
}

export const CesiumViewerContainer: React.FC<CesiumViewerContainerProps> = ({
  onEngineReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<OceanEngine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const esriProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
    });

    let viewer: Cesium.Viewer;

    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: new Cesium.ImageryLayer(esriProvider),
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        vrButton: false,
        useDefaultRenderLoop: true,
        shadows: false,
      });
    } catch (err) {
      console.warn('Fallback viewer initialization:', err);
      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        vrButton: false,
        useDefaultRenderLoop: true,
        shadows: false,
      });
    }

    viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
      console.warn('Cesium render error intercepted gracefully:', error);
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    const engine = new OceanEngine(viewer);
    engineRef.current = engine;

    if (onEngineReady) {
      onEngineReady(engine);
    }

    return () => {
      engine.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="cesium-container"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
        backgroundColor: '#02060E',
      }}
    />
  );
};
