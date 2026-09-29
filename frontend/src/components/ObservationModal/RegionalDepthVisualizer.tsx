import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OceanState } from '../../ocean/OceanState';
import {
  type OceanRegionConfig,
  type OceanVariable,
  type ProfileVariable,
  type SelectedObservation,
  type ObservationProfilePayload,
} from '../../types/ocean';

interface RegionalDepthVisualizerProps {
  regionConfig: OceanRegionConfig;
  currentDepth: number;
  variable: ProfileVariable;
  observation: SelectedObservation | null;
  payload: ObservationProfilePayload | null;
  onDepthChange: (newDepth: number) => void;
}

export const RegionalDepthVisualizer: React.FC<RegionalDepthVisualizerProps> = ({
  regionConfig,
  currentDepth,
  variable,
  observation,
  payload,
  onDepthChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const activeLayerMeshRef = useRef<THREE.Mesh | null>(null);
  const probeMarkerGroupRef = useRef<THREE.Group | null>(null);
  const depthPlaneMeshRef = useRef<THREE.Mesh | null>(null);

  const rotationRef = useRef({ x: 0.38, y: -0.45 });
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });

  // Map lat/lon to local 3D coordinates [-9, 9] x [-9, 9]
  const geoToLocal = (lon: number, lat: number) => {
    const { west, east, south, north } = regionConfig.bounds;
    const normX = (lon - west) / (east - west || 1);
    const normZ = (lat - south) / (north - south || 1);
    const x = (normX - 0.5) * 18;
    const z = -(normZ - 0.5) * 18;
    return { x, z };
  };

  // Map depth in meters to Y coordinate [3.5 (surface) to -5.5 (maxDepth)]
  const depthToY = (depthM: number) => {
    const maxM = Math.max(100, regionConfig.grid.maxDepthM);
    const norm = Math.max(0, Math.min(1, depthM / maxM));
    return 3.5 - norm * 9.0;
  };

  // Convert variable value to color using OceanState palette
  const getThreeColorForValue = (val: number): THREE.Color => {
    const oceanVar: OceanVariable =
      variable === 'temperature'
        ? 'temperature'
        : variable === 'salinity'
        ? 'salinity'
        : variable === 'currentSpeed'
        ? 'current'
        : 'chlorophyll';

    const cesiumColor = OceanState.getInstance().getCesiumColorForVariable(oceanVar, val);
    return new THREE.Color(cesiumColor.red, cesiumColor.green, cesiumColor.blue);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 420;

    // Scene & Perspective Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#141d28'); // Deep oceanic slate

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 10, 24);
    camera.lookAt(0, -0.5, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfef08a, 0.6);
    dirLight.position.set(12, 20, 15);
    scene.add(dirLight);

    // Root Group for interactive rotation
    const rootGroup = new THREE.Group();
    rootGroup.rotation.x = rotationRef.current.x;
    rootGroup.rotation.y = rotationRef.current.y;
    scene.add(rootGroup);

    // 1. Build Multi-tier Volumetric Slices for this water body
    const footprint = regionConfig.footprint;
    if (footprint.length >= 3) {
      // Shape geometry from normalized footprint
      const shape = new THREE.Shape();
      footprint.forEach(([lon, lat], idx) => {
        const { x, z } = geoToLocal(lon, lat);
        if (idx === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });
      shape.closePath();

      // Exterior outline points
      const outlinePoints: THREE.Vector3[] = [];
      footprint.forEach(([lon, lat]) => {
        const { x, z } = geoToLocal(lon, lat);
        outlinePoints.push(new THREE.Vector3(x, 0, z));
      });
      const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);

      // Create depth slices (Surface + Intermediate layers + Abyss)
      const numSlices = Math.min(8, Math.max(4, regionConfig.grid.depthLayers));
      const maxM = regionConfig.grid.maxDepthM;

      for (let s = 0; s < numSlices; s++) {
        const sliceNorm = s / (numSlices - 1);
        const sliceDepth = sliceNorm * maxM;
        const yPos = depthToY(sliceDepth);

        // Outline contour ring
        const contourMat = new THREE.LineBasicMaterial({
          color: s === 0 ? 0x38bdf8 : 0x224466,
          transparent: true,
          opacity: s === 0 ? 0.9 : 0.35,
          linewidth: s === 0 ? 2 : 1,
        });
        const contourLine = new THREE.LineLoop(outlineGeo, contourMat);
        contourLine.position.y = yPos;
        contourLine.rotation.x = Math.PI / 2;
        rootGroup.add(contourLine);

        // Subtle slice plane
        const planeGeo = new THREE.ShapeGeometry(shape);
        const planeMat = new THREE.MeshBasicMaterial({
          color: s === 0 ? 0x0ea5e9 : 0x1e3a5f,
          transparent: true,
          opacity: s === 0 ? 0.08 : 0.03,
          side: THREE.DoubleSide,
        });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        planeMesh.position.y = yPos;
        planeMesh.rotation.x = Math.PI / 2;
        rootGroup.add(planeMesh);
      }

      // Vertical Struts at bounding extremes for 3D volumetric prism
      const cornerCoords = [
        [regionConfig.bounds.west, regionConfig.bounds.south],
        [regionConfig.bounds.east, regionConfig.bounds.south],
        [regionConfig.bounds.east, regionConfig.bounds.north],
        [regionConfig.bounds.west, regionConfig.bounds.north],
      ];
      cornerCoords.forEach(([lon, lat]) => {
        const { x, z } = geoToLocal(lon, lat);
        const strutGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, depthToY(0), z),
          new THREE.Vector3(x, depthToY(maxM), z),
        ]);
        const strutMat = new THREE.LineDashedMaterial({
          color: 0x334e68,
          dashSize: 0.4,
          gapSize: 0.3,
          transparent: true,
          opacity: 0.35,
        });
        const strutLine = new THREE.Line(strutGeo, strutMat);
        strutLine.computeLineDistances();
        rootGroup.add(strutLine);
      });

      // 2. Active Depth Scanning Layer (Dynamic horizontal plane)
      const activeGeo = new THREE.ShapeGeometry(shape, 32);
      const activeMat = new THREE.MeshBasicMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        wireframe: false,
      });
      const activeMesh = new THREE.Mesh(activeGeo, activeMat);
      activeMesh.rotation.x = Math.PI / 2;
      activeMesh.position.y = depthToY(currentDepth);
      rootGroup.add(activeMesh);
      activeLayerMeshRef.current = activeMesh;

      // Active Layer Glowing Border
      const activeBorderMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        linewidth: 2.5,
        transparent: true,
        opacity: 0.95,
      });
      const activeBorder = new THREE.LineLoop(outlineGeo, activeBorderMat);
      activeBorder.rotation.x = Math.PI / 2;
      activeBorder.position.y = depthToY(currentDepth);
      rootGroup.add(activeBorder);
      depthPlaneMeshRef.current = activeBorder as unknown as THREE.Mesh;
    }

    // 3. Observation 3D Sounding Column & Intersecting Probe Node
    const probeGroup = new THREE.Group();
    probeMarkerGroupRef.current = probeGroup;
    rootGroup.add(probeGroup);

    let obsLon = (regionConfig.bounds.west + regionConfig.bounds.east) / 2;
    let obsLat = (regionConfig.bounds.south + regionConfig.bounds.north) / 2;

    if (observation) {
      if (observation.type === 'argo') {
        const argo = observation.data;
        obsLon = argo.longitude;
        obsLat = argo.latitude;
      } else {
        const glider = observation.data;
        const lastWp = glider.waypoints[glider.waypoints.length - 1];
        if (lastWp) {
          obsLon = lastWp.longitude;
          obsLat = lastWp.latitude;
        }
      }
    }

    const { x: obsX, z: obsZ } = geoToLocal(obsLon, obsLat);
    const surfaceY = depthToY(0);
    const bottomY = depthToY(Math.min(2500, regionConfig.grid.maxDepthM));

    // A. Vertical Sounding Filament (from Surface to Deep ocean)
    const soundingGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(obsX, surfaceY + 0.5, obsZ),
      new THREE.Vector3(obsX, bottomY, obsZ),
    ]);
    const soundingMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.35,
      gapSize: 0.2,
      linewidth: 2,
    });
    const soundingLine = new THREE.Line(soundingGeo, soundingMat);
    soundingLine.computeLineDistances();
    probeGroup.add(soundingLine);

    // B. Surface Beacon Instrument (0m)
    const surfaceMarkerGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const surfaceMarkerMat = new THREE.MeshStandardMaterial({
      color: observation?.type === 'glider' ? 0xfacc15 : 0xf87171,
      roughness: 0.2,
      metalness: 0.5,
    });
    const surfaceMarker = new THREE.Mesh(surfaceMarkerGeo, surfaceMarkerMat);
    surfaceMarker.position.set(obsX, surfaceY + 0.3, obsZ);
    probeGroup.add(surfaceMarker);

    // Surface Beacon Pulsing Ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.7, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: observation?.type === 'glider' ? 0xfacc15 : 0xf87171,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(obsX, surfaceY + 0.05, obsZ);
    probeGroup.add(ringMesh);

    // C. Active Depth Probe Intersection Node (at currentDepth)
    const probeNodeGeo = new THREE.SphereGeometry(0.38, 20, 20);
    const probeNodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      roughness: 0.1,
    });
    const probeNode = new THREE.Mesh(probeNodeGeo, probeNodeMat);
    probeNode.position.set(obsX, depthToY(currentDepth), obsZ);
    probeGroup.add(probeNode);

    // Halo around active depth node
    const haloGeo = new THREE.RingGeometry(0.6, 0.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.set(obsX, depthToY(currentDepth), obsZ);
    probeGroup.add(haloMesh);

    // Render loop
    let animId: number;
    let pulseAngle = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Rotate group smoothly
      rootGroup.rotation.x = rotationRef.current.x;
      rootGroup.rotation.y = rotationRef.current.y;

      // Pulse beacon rings
      pulseAngle += 0.035;
      const pulseScale = 1.0 + Math.sin(pulseAngle) * 0.2;
      ringMesh.scale.set(pulseScale, pulseScale, 1);
      haloMesh.scale.set(pulseScale, pulseScale, 1);

      renderer.render(scene, camera);
    };
    animate();

    // Mouse drag interaction to rotate 3D ocean
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;

      rotationRef.current.y += dx * 0.008;
      rotationRef.current.x = Math.max(
        0.1,
        Math.min(1.2, rotationRef.current.x + dy * 0.008)
      );

      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Wheel Scroll on 3D Visualizer to Navigate Depth
    // Up = Shallower (depth decreases), Down = Deeper (depth increases)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = 50;
      if (e.deltaY < 0) {
        // Scroll Up -> Move toward shallower layers
        onDepthChange(Math.max(0, currentDepth - step));
      } else if (e.deltaY > 0) {
        // Scroll Down -> Move toward deeper layers
        onDepthChange(Math.min(regionConfig.grid.maxDepthM, currentDepth + step));
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Handle container resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, [regionConfig, observation]);

  // Update Active Depth plane and Probe node position when currentDepth or variable changes
  useEffect(() => {
    const yPos = depthToY(currentDepth);

    if (activeLayerMeshRef.current) {
      activeLayerMeshRef.current.position.y = yPos;
    }

    if (depthPlaneMeshRef.current) {
      depthPlaneMeshRef.current.position.y = yPos;
    }

    if (probeMarkerGroupRef.current) {
      // Find the probe node and halo inside probeGroup
      const probeNode = probeMarkerGroupRef.current.children[2];
      const haloMesh = probeMarkerGroupRef.current.children[3];
      if (probeNode) probeNode.position.y = yPos;
      if (haloMesh) haloMesh.position.y = yPos;
    }

    // Update active layer color based on selected variable value at this depth
    if (activeLayerMeshRef.current && payload?.profile) {
      // Find closest depth sample in model profile
      let modelVal = 18.0;
      if (payload.profile.depths && payload.profile.model) {
        let bestDiff = Infinity;
        payload.profile.depths.forEach((d, idx) => {
          const diff = Math.abs(d - currentDepth);
          if (diff < bestDiff) {
            bestDiff = diff;
            const sample = payload.profile.model[idx];
            if (sample && typeof sample[variable] === 'number') {
              modelVal = sample[variable] as number;
            }
          }
        });
      }
      const threeColor = getThreeColorForValue(modelVal);
      (activeLayerMeshRef.current.material as THREE.MeshBasicMaterial).color = threeColor;
    }
  }, [currentDepth, variable, payload]);

  return (
    <div className="regional-3d-visualizer-container" ref={mountRef}>
      {/* 3D WebGL Canvas mounts here */}
    </div>
  );
};
