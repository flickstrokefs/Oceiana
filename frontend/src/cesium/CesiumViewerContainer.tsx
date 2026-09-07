import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { OceanEngine } from '../ocean/OceanEngine';

// Ensure Cesium base URL is valid
if (typeof window !== 'undefined') {
  const win = window as unknown as { CESIUM_BASE_URL?: string };
  if (!win.CESIUM_BASE_URL) {
    win.CESIUM_BASE_URL = '/';
  }
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

    let viewer: Cesium.Viewer;

    try {
      const baseImageryProvider = Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      );

      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(baseImageryProvider),
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
        creditContainer: document.createElement('div'),
      });
    } catch (err) {
      console.warn('Fallback viewer initialization:', err);
      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: false,
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
        creditContainer: document.createElement('div'),
      });
    }

    viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
      console.warn('Cesium render error intercepted gracefully:', error);
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // Background color for deep ocean look
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020b1c');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');

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
  }, [onEngineReady]);

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
