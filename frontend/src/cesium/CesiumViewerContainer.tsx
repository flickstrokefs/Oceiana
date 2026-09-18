import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { OceanEngine } from '../ocean/OceanEngine';

// Explicitly set Cesium base URL to match vite-plugin-cesium asset directory
if (typeof window !== 'undefined') {
  const win = window as unknown as { CESIUM_BASE_URL?: string };
  win.CESIUM_BASE_URL = '/cesium/';
}
try {
  (Cesium.buildModuleUrl as unknown as { setBaseUrl?: (url: string) => void }).setBaseUrl?.('/cesium/');
} catch (_e) {
  // Ignored if already defined
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
  const onEngineReadyRef = useRef(onEngineReady);

  // Keep latest callback reference without triggering viewer re-initialization
  useEffect(() => {
    onEngineReadyRef.current = onEngineReady;
  }, [onEngineReady]);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: Cesium.Viewer | null = null;
    let engine: OceanEngine | null = null;

    try {
      // Check for optional Cesium Ion Token
      const ionToken =
        import.meta.env.VITE_CESIUM_ION_TOKEN ||
        (typeof window !== 'undefined' && (window as unknown as { CESIUM_ION_TOKEN?: string }).CESIUM_ION_TOKEN);

      if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken;
      }

      // 1. Instant, reliable offline NaturalEarthII imagery (0 network latency, 100% stable)
      const localProvider = Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      );

      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: Cesium.ImageryLayer.fromProviderAsync(localProvider),
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
        contextOptions: {
          webgl: {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: true,
            failIfMajorPerformanceCaveat: false,
          },
        },
      });

      // 2. Asynchronously overlay high-resolution satellite imagery (Esri World Imagery or Ion)
      (async () => {
        try {
          let highResProvider: Cesium.ImageryProvider;
          if (ionToken) {
            highResProvider = await Cesium.createWorldImageryAsync();
          } else {
            highResProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
              { enablePickFeatures: false }
            );
          }
          if (viewer && !viewer.isDestroyed()) {
            viewer.imageryLayers.addImageryProvider(highResProvider);
          }
        } catch (satelliteErr) {
          console.warn('[Cesium Satellite Imagery Overlay Fallback]:', satelliteErr);
        }
      })();
    } catch (err) {
      console.warn('Primary viewer initialization fallback:', err);
      try {
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
      } catch (fatalErr) {
        console.error('Critical WebGL / Cesium initialization error:', fatalErr);
        const panel = document.createElement('div');
        panel.id = 'cesium-custom-error-panel';
        panel.style.cssText =
          'position:fixed;top:24px;left:24px;right:24px;background:rgba(15,23,42,0.96);border:1px solid #ef4444;color:#f8fafc;padding:24px;border-radius:12px;z-index:99999;font-family:monospace;font-size:13px;backdrop-filter:blur(12px);';
        panel.innerHTML = `
          <div style="font-size:16px;font-weight:bold;color:#ef4444;margin-bottom:8px;">⚠️ 3D Geospatial Engine (WebGL) Notice</div>
          <p style="color:#94a3b8;margin:0 0 12px 0;">Cesium requires WebGL hardware acceleration to be enabled in your browser.</p>
          <div style="font-size:11px;color:#cbd5e1;background:rgba(0,0,0,0.4);padding:12px;border-radius:6px;">
            Tip: In Chrome/Edge, navigate to <strong>chrome://settings/system</strong> and verify that <em>"Use graphics acceleration when available"</em> is enabled.
          </div>
        `;
        document.body.appendChild(panel);
        return;
      }
    }

    if (!viewer) return;

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

    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;

    // Base globe ocean styling
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020b1c');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');

    engine = new OceanEngine(viewer);
    engineRef.current = engine;

    if (onEngineReadyRef.current) {
      onEngineReadyRef.current(engine);
    }

    return () => {
      if (engine) {
        engine.destroy();
        engineRef.current = null;
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []); // Run ONLY ONCE on mount! Do not re-mount when callback reference updates

  return (
    // INTEGRATION — Underwater 3D structure / ocean volume mesh:
    // Mount future Cesium primitives (tileset, custom geometry, isosurfaces)
    // via OceanEngine / UnderwaterEnvironment. Observation Profile overlays
    // this live viewer — never replace it with a static mock screenshot.
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
