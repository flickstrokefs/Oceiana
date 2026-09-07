import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { OceanEngine } from '../ocean/OceanEngine';

// Explicitly set Cesium base URL to match vite-plugin-cesium asset directory
if (typeof window !== 'undefined') {
  const win = window as unknown as { CESIUM_BASE_URL?: string };
  win.CESIUM_BASE_URL = '/cesium/';
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
      console.warn('Primary viewer initialization fallback:', err);
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

    // Comprehensive error formatting for CesiumWidget error panel
    if (viewer.cesiumWidget) {
      viewer.cesiumWidget.showErrorPanel = (title: string, message: string, error?: unknown) => {
        const err = error as { name?: string; message?: string; stack?: string } | undefined;
        const details = [
          err?.name ? `Error Type: ${err.name}` : '',
          err?.message ? `Error Message: ${err.message}` : '',
          err?.stack ? `Stack Trace:\n${err.stack}` : '',
          typeof error === 'object' && error
            ? `Raw Object:\n${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`
            : String(error ?? '')
        ].filter(Boolean).join('\n\n');

        console.error(`[Cesium Engine Error] ${title} - ${message}:`, details, error);

        const existing = document.getElementById('cesium-custom-error-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'cesium-custom-error-panel';
        panel.style.cssText =
          'position:fixed;top:16px;left:16px;right:16px;max-height:80vh;background:rgba(2,6,23,0.95);border:1px solid #ef4444;color:#f8fafc;padding:20px;border-radius:12px;z-index:99999;font-family:monospace;font-size:12px;overflow-y:auto;white-space:pre-wrap;backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,0,0,0.7);';

        panel.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(239,68,68,0.3);padding-bottom:8px;">
            <span style="color:#ef4444;font-size:14px;font-weight:bold;">⚠️ Cesium Engine Error: ${title}</span>
            <button onclick="document.getElementById('cesium-custom-error-panel').remove()" style="padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Dismiss</button>
          </div>
          <p style="color:#94a3b8;margin:0 0 10px 0;">${message}</p>
          <pre style="background:rgba(0,0,0,0.5);color:#fca5a5;padding:12px;border-radius:8px;overflow-x:auto;border:1px solid rgba(239,68,68,0.2);">${details || 'No additional stack details.'}</pre>
        `;
        document.body.appendChild(panel);
      };
    }

    viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
      const err = error as { name?: string; message?: string; stack?: string } | undefined;
      console.error('[Cesium Scene Render Error]:', err?.message || error, err?.stack || error);
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
