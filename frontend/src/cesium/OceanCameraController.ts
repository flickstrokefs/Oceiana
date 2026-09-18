import * as Cesium from 'cesium';
import type { OceanMode } from '../types/ocean';
import { UNDERWATER_REGIONS } from '../types/ocean';
import type { UnderwaterEnvironment } from './UnderwaterEnvironment';

export type CameraInteractionMode =
  | 'IDLE'
  | 'PAN'
  | 'ZOOM'
  | 'ORBIT'
  | 'TILT'
  | 'FLY_TO'
  | 'UNDERWATER'
  | 'SETTLING';

export interface CameraFlyToOptions {
  latitude: number;
  longitude: number;
  altitude?: number;
  depth?: number;
  heading?: number; // degrees
  pitch?: number;   // degrees
  roll?: number;    // degrees
  duration?: number; // seconds
  onComplete?: () => void;
}

export interface CameraStateSnapshot {
  latitude: number;
  longitude: number;
  altitude: number;
  depth: number;
  targetLatitude: number;
  targetLongitude: number;
  range: number;
  heading: number; // degrees
  pitch: number;   // degrees
  roll: number;    // degrees
  zoomVelocity: number;
  panVelocityX: number;
  panVelocityY: number;
  orbitVelocityHeading: number;
  orbitVelocityPitch: number;
  mode: CameraInteractionMode;
  isUnderwater: boolean;
}

export class OceanCameraController {
  private viewer: Cesium.Viewer;
  private underwaterEnv: UnderwaterEnvironment;

  // Camera state representation (target-anchored spherical coordinates)
  private targetCartesian = new Cesium.Cartesian3();
  private targetCartographic = new Cesium.Cartographic(
    Cesium.Math.toRadians(75.0),
    Cesium.Math.toRadians(14.0),
    0.0
  );

  private range = 5000000.0; // Distance from target in meters
  private heading = Cesium.Math.toRadians(0.0); // Azimuth (0 = North)
  private pitch = Cesium.Math.toRadians(-72.0); // Elevation (-90 = Nadir)
  private roll = 0.0;

  private currentDepth = 0.0; // Underwater depth in meters (0 = surface)
  private isUnderwater = false;
  private currentMode: OceanMode = 'surface';
  private interactionMode: CameraInteractionMode = 'IDLE';

  // Inertia & Physics Velocities
  private zoomVelocity = 0.0;
  private panVelocityX = 0.0;
  private panVelocityY = 0.0;
  private orbitVelocityHeading = 0.0;
  private orbitVelocityPitch = 0.0;

  // Damping factors (per frame at 60fps)
  private readonly zoomDamping = 0.82;
  private readonly panDamping = 0.88;
  private readonly orbitDamping = 0.85;

  // Limits
  private readonly minRange = 400.0; // Above surface
  private readonly maxRange = 30000000.0; // Deep space planetary overview
  private readonly minPitch = Cesium.Math.toRadians(-89.5);
  private readonly maxPitch = Cesium.Math.toRadians(-12.0);
  private readonly maxDepth = 5000.0;

  // Input tracking
  private isLeftDown = false;
  private isRightDown = false;
  private isMiddleDown = false;
  private isAltKey = false;
  private isShiftKey = false;
  private isCtrlKey = false;

  private lastMouseX = 0;
  private lastMouseY = 0;

  // Touch tracking
  private activePointers = new Map<number, { x: number; y: number }>();
  private initialPinchDistance = 0;
  private initialPinchRange = 0;
  private initialPinchAngle = 0;

  // Cursor-anchored zoom target
  private cursorWindowPos = new Cesium.Cartesian2();
  private zoomAnchorCartesian = new Cesium.Cartesian3();
  private zoomAnchorCartographic = new Cesium.Cartographic();
  private hasZoomAnchor = false;

  // Smooth Fly-To transition state
  private flyToActive = false;
  private flyToStartTime = 0;
  private flyToDuration = 0;
  private flyToStartTarget = new Cesium.Cartographic();
  private flyToEndTarget = new Cesium.Cartographic();
  private flyToStartRange = 0;
  private flyToEndRange = 0;
  private flyToApexRange = 0;
  private flyToStartHeading = 0;
  private flyToEndHeading = 0;
  private flyToStartPitch = 0;
  private flyToEndPitch = 0;
  private flyToOnComplete: (() => void) | null = null;

  // Keyboard navigation flags
  private keyState = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    KeyQ: false,
    KeyE: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  };

  // Reusable scratch variables to avoid GC allocations during render loop
  private scratchRay = new Cesium.Ray();
  private scratchCartesian = new Cesium.Cartesian3();
  private scratchCartesian2 = new Cesium.Cartesian3();
  private scratchCartographic = new Cesium.Cartographic();
  private scratchMatrix4 = new Cesium.Matrix4();

  // Listeners & Cleanup
  private removePreRenderListener: (() => void) | null = null;
  private domEventCleanups: (() => void)[] = [];

  // Debug Panel DOM Element
  private debugPanel: HTMLElement | null = null;
  private debugVisible = false;

  constructor(viewer: Cesium.Viewer, underwaterEnv: UnderwaterEnvironment) {
    this.viewer = viewer;
    this.underwaterEnv = underwaterEnv;

    // Disable Cesium's default screenSpaceCameraController to take 100% ownership of camera physics
    const sscc = this.viewer.scene.screenSpaceCameraController;
    sscc.enableRotate = false;
    sscc.enableTranslate = false;
    sscc.enableZoom = false;
    sscc.enableTilt = false;
    sscc.enableLook = false;

    // Initialize position and listeners
    this.setInitialView();
    this.bindInputs();
    this.bindPhysicsLoop();
    this.setupDebugPanel();
  }

  /**
   * Initializes default orbital overview focusing on the Arabian Sea & Bay of Bengal.
   */
  public setInitialView(): void {
    this.targetCartographic = new Cesium.Cartographic(
      Cesium.Math.toRadians(75.0),
      Cesium.Math.toRadians(14.0),
      0.0
    );
    Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.targetCartographic, this.targetCartesian);

    this.range = 5000000.0;
    this.heading = Cesium.Math.toRadians(0.0);
    this.pitch = Cesium.Math.toRadians(-72.0);
    this.roll = 0.0;
    this.currentDepth = 0.0;
    this.isUnderwater = false;

    this.applyCameraTransform();
  }

  // ==========================================
  // INPUT BINDINGS (Mouse, Wheel, Touch, Keys)
  // ==========================================

  private bindInputs(): void {
    const canvas = this.viewer.canvas;

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      this.isAltKey = e.altKey;
      this.isShiftKey = e.shiftKey;
      this.isCtrlKey = e.ctrlKey;

      if (e.button === 0) this.isLeftDown = true;
      if (e.button === 1) this.isMiddleDown = true;
      if (e.button === 2) this.isRightDown = true;

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.cursorWindowPos.x = e.clientX;
      this.cursorWindowPos.y = e.clientY;

      // Halt any ongoing zoom inertia on click for immediate tactile control
      this.zoomVelocity = 0.0;

      // User interaction cancels automated fly-to smoothly
      if (this.flyToActive) {
        this.cancelFlyTo();
      }

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.initialPinchRange = this.range;
        this.initialPinchAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      this.cursorWindowPos.x = e.clientX;
      this.cursorWindowPos.y = e.clientY;

      this.isAltKey = e.altKey;
      this.isShiftKey = e.shiftKey;
      this.isCtrlKey = e.ctrlKey;

      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Single Pointer Drag (Pan, Orbit, or Tilt)
      if (this.activePointers.size === 1) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;

        const isOrbit = this.isMiddleDown || this.isRightDown || (this.isLeftDown && (this.isAltKey || this.isCtrlKey));
        const isTilt = this.isLeftDown && this.isShiftKey;

        if (isTilt) {
          // Pure Pitch / Tilt
          const tiltScale = 0.0035;
          this.orbitVelocityPitch = -dy * tiltScale;
          this.interactionMode = 'TILT';
        } else if (isOrbit) {
          // Orbit around target: horizontal controls heading, vertical controls pitch
          const orbitScale = 0.0035;
          this.orbitVelocityHeading = -dx * orbitScale;
          this.orbitVelocityPitch = -dy * orbitScale;
          this.interactionMode = 'ORBIT';
        } else if (this.isLeftDown) {
          // Natural Globe Grab / Pan
          // Pan speed scaled by current altitude so cursor tracks geographic point
          const panFactor = (this.range / 12000000.0) * 0.0006;
          this.panVelocityX = -dx * panFactor;
          this.panVelocityY = dy * panFactor;
          this.interactionMode = 'PAN';
        }

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else if (this.activePointers.size === 2) {
        // Two-Finger Touch Gestures: Pinch-Zoom, Twist-Heading, Vertical-Tilt
        const pts = Array.from(this.activePointers.values());
        const currentDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const currentAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);

        if (this.initialPinchDistance > 10) {
          const ratio = currentDistance / this.initialPinchDistance;
          this.range = Math.max(this.minRange, Math.min(this.maxRange, this.initialPinchRange / ratio));
          this.interactionMode = 'ZOOM';
        }

        // Two-finger twist rotates heading
        const dAngle = currentAngle - this.initialPinchAngle;
        if (Math.abs(dAngle) > 0.02) {
          this.orbitVelocityHeading = -dAngle * 0.5;
          this.initialPinchAngle = currentAngle;
        }

        this.lastMouseX = (pts[0].x + pts[1].x) * 0.5;
        this.lastMouseY = (pts[0].y + pts[1].y) * 0.5;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe fallback
      }

      if (e.button === 0) this.isLeftDown = false;
      if (e.button === 1) this.isMiddleDown = false;
      if (e.button === 2) this.isRightDown = false;

      if (this.activePointers.size === 0) {
        this.interactionMode = 'SETTLING';
      }
    };

    // Google Earth-Style Continuous Wheel Zoom with Cursor-Centered Tracking
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (this.flyToActive) {
        this.cancelFlyTo();
      }

      // Zero out orbit and pan momentum so wheel zoom NEVER rotates or drifts the globe
      this.orbitVelocityHeading = 0.0;
      this.orbitVelocityPitch = 0.0;
      this.panVelocityX = 0.0;
      this.panVelocityY = 0.0;

      // Normalize wheel delta across browsers and devices
      let delta = e.deltaY;
      if (e.deltaMode === 1) {
        // DOM_DELTA_LINE
        delta *= 33.33;
      } else if (e.deltaMode === 2) {
        // DOM_DELTA_PAGE
        delta *= 100.0;
      }

      // Clamp single-event delta to avoid huge sudden spikes
      const clampedDelta = Math.max(-150.0, Math.min(150.0, delta));
      const notches = clampedDelta / 100.0; // 1 standard notch ~ 1.0 (out) or -1.0 (in)

      // Nonlinear altitude-scaled impulse:
      // At planetary altitude (10,000km): moves ~750km per notch.
      // At regional altitude (2,000km): moves ~150km per notch.
      // At local altitude (50km): moves ~3.8km per notch.
      // At low altitude (<1km): controlled precision.
      const scale = Math.max(800.0, this.range);
      const impulse = notches * scale * 0.82;
      this.zoomVelocity += impulse;

      // Limit maximum zoom speed to prevent erratic teleportation on fast trackpad flicks
      const maxSpeed = Math.max(3000.0, this.range * 4.0);
      this.zoomVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, this.zoomVelocity));

      this.cursorWindowPos.x = e.clientX;
      this.cursorWindowPos.y = e.clientY;
      this.interactionMode = 'ZOOM';

      // Pick geographic anchor directly beneath the cursor
      const ray = this.viewer.camera.getPickRay(this.cursorWindowPos, this.scratchRay);
      if (ray) {
        const hit =
          this.viewer.scene.globe.pick(ray, this.viewer.scene, this.scratchCartesian) ||
          this.viewer.camera.pickEllipsoid(this.cursorWindowPos, Cesium.Ellipsoid.WGS84, this.scratchCartesian);
        if (hit) {
          Cesium.Cartesian3.clone(hit, this.zoomAnchorCartesian);
          Cesium.Ellipsoid.WGS84.cartesianToCartographic(hit, this.zoomAnchorCartographic);
          this.hasZoomAnchor = true;
        } else {
          this.hasZoomAnchor = false;
        }
      } else {
        this.hasZoomAnchor = false;
      }
    };

    // Double Click Fly-To Target
    const onDoubleClick = (e: MouseEvent) => {
      const windowPos = new Cesium.Cartesian2(e.clientX, e.clientY);
      const ray = this.viewer.camera.getPickRay(windowPos, this.scratchRay);
      if (!ray) return;

      const pickCartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene, this.scratchCartesian);
      if (pickCartesian) {
        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pickCartesian, this.scratchCartographic);
        const targetLon = Cesium.Math.toDegrees(carto.longitude);
        const targetLat = Cesium.Math.toDegrees(carto.latitude);

        // Calculate appropriate target altitude (closer than current, clamped to regional view)
        const targetAlt = Math.max(80000.0, this.range * 0.35);

        this.flyTo({
          latitude: targetLat,
          longitude: targetLon,
          altitude: targetAlt,
          heading: Cesium.Math.toDegrees(this.heading),
          pitch: Cesium.Math.toDegrees(this.pitch),
          duration: 1.6,
        });
      }
    };

    // Keyboard Navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code in this.keyState) {
        this.keyState[e.code as keyof typeof this.keyState] = true;
      }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        this.resetCamera();
      }
      if (e.code === 'Backquote' || (e.ctrlKey && e.shiftKey && e.code === 'KeyD')) {
        this.toggleDebug();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code in this.keyState) {
        this.keyState[e.code as keyof typeof this.keyState] = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu to allow smooth right-click orbit
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.domEventCleanups.push(
      () => canvas.removeEventListener('pointerdown', onPointerDown),
      () => window.removeEventListener('pointermove', onPointerMove),
      () => window.removeEventListener('pointerup', onPointerUp),
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('dblclick', onDoubleClick),
      () => canvas.removeEventListener('contextmenu', onContextMenu),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp)
    );
  }



  // ==========================================
  // PHYSICS & FRAME INTEGRATION LOOP
  // ==========================================

  private bindPhysicsLoop(): void {
    let lastTime = performance.now();

    const onPreRender = () => {
      if (this.viewer.isDestroyed()) return;

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000.0);
      lastTime = now;

      this.updatePhysics(dt);
      this.applyCameraTransform();
      this.updateDebugPanel();
    };

    this.removePreRenderListener = this.viewer.scene.preRender.addEventListener(onPreRender);
  }

  private updatePhysics(dt: number): void {
    // 1. Process Fly-To interpolation if active
    if (this.flyToActive) {
      this.updateFlyTo(performance.now() / 1000.0);
      return;
    }

    // 2. Process Keyboard continuous input
    this.processKeyboardInput(dt);

    // 3. Integrate Zoom with exponential damping and cursor-anchored target tracking
    if (Math.abs(this.zoomVelocity) > 0.5) {
      const deltaRange = this.zoomVelocity * dt;
      const oldRange = this.range;
      this.range = Math.max(this.minRange, Math.min(this.maxRange, this.range + deltaRange));
      const actualDeltaRange = this.range - oldRange;

      // Cursor-anchored target shift:
      // When zooming in (actualDeltaRange < 0), fraction > 0 moves target smoothly toward anchor.
      // When zooming out (actualDeltaRange > 0), fraction < 0 moves target smoothly away from anchor.
      // Target shift matches the exact fraction of range traveled this frame, ensuring the
      // geographic feature beneath the cursor remains fixed on screen with zero globe rotation.
      if (this.hasZoomAnchor && oldRange > 0.001 && Math.abs(actualDeltaRange) > 0.0001) {
        const fraction = -actualDeltaRange / oldRange;
        const clampedFraction = Math.max(-0.25, Math.min(0.25, fraction));

        const dLon = Cesium.Math.negativePiToPi(
          this.zoomAnchorCartographic.longitude - this.targetCartographic.longitude
        );
        const dLat = this.zoomAnchorCartographic.latitude - this.targetCartographic.latitude;

        this.targetCartographic.longitude += dLon * clampedFraction;
        this.targetCartographic.latitude += dLat * clampedFraction;

        this.targetCartographic.longitude = Cesium.Math.negativePiToPi(this.targetCartographic.longitude);
        this.targetCartographic.latitude = Math.max(
          Cesium.Math.toRadians(-85.0),
          Math.min(Cesium.Math.toRadians(85.0), this.targetCartographic.latitude)
        );

        Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.targetCartographic, this.targetCartesian);
      }

      this.zoomVelocity *= Math.pow(this.zoomDamping, dt * 60.0);

      // Handle continuous transition into ocean depth
      if (this.range < 2000.0 && this.currentMode === 'underwater') {
        const depthDelta = -this.zoomVelocity * dt * 0.05;
        this.currentDepth = Math.max(0.0, Math.min(this.maxDepth, this.currentDepth + depthDelta));
      }
    } else {
      this.zoomVelocity = 0.0;
      if (this.interactionMode === 'ZOOM') {
        this.interactionMode = 'SETTLING';
      }
    }

    // Clamp range within physical scale
    this.range = Math.max(this.minRange, Math.min(this.maxRange, this.range));

    // NOTE: Auto-tilt during manual zoom is intentionally omitted to guarantee
    // zero heading/pitch distortion or globe rotation during wheel navigation.

    // 4. Integrate Pan Velocity (Great circle surface movement)
    if (Math.abs(this.panVelocityX) > 0.000001 || Math.abs(this.panVelocityY) > 0.000001) {
      // Rotate movement vector by current camera heading so screen left/right is intuitive
      const cosH = Math.cos(this.heading);
      const sinH = Math.sin(this.heading);
      const rotLon = this.panVelocityX * cosH - this.panVelocityY * sinH;
      const rotLat = this.panVelocityX * sinH + this.panVelocityY * cosH;

      this.targetCartographic.longitude += rotLon;
      this.targetCartographic.latitude += rotLat;

      // Wrap longitude [-PI, +PI] and clamp latitude
      this.targetCartographic.longitude = Cesium.Math.negativePiToPi(this.targetCartographic.longitude);
      this.targetCartographic.latitude = Math.max(
        Cesium.Math.toRadians(-85.0),
        Math.min(Cesium.Math.toRadians(85.0), this.targetCartographic.latitude)
      );

      Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.targetCartographic, this.targetCartesian);

      this.panVelocityX *= Math.pow(this.panDamping, dt * 60.0);
      this.panVelocityY *= Math.pow(this.panDamping, dt * 60.0);
    } else {
      this.panVelocityX = 0.0;
      this.panVelocityY = 0.0;
    }

    // 5. Integrate Orbit / Tilt (Heading & Pitch)
    if (Math.abs(this.orbitVelocityHeading) > 0.00001) {
      this.heading += this.orbitVelocityHeading * dt * 60.0;
      this.heading = Cesium.Math.negativePiToPi(this.heading);
      this.orbitVelocityHeading *= Math.pow(this.orbitDamping, dt * 60.0);
    } else {
      this.orbitVelocityHeading = 0.0;
    }

    if (Math.abs(this.orbitVelocityPitch) > 0.00001) {
      this.pitch += this.orbitVelocityPitch * dt * 60.0;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
      this.orbitVelocityPitch *= Math.pow(this.orbitDamping, dt * 60.0);
    } else {
      this.orbitVelocityPitch = 0.0;
    }

    // 6. Surface Crossing & Underwater Detection
    const shouldBeUnderwater = this.currentMode === 'underwater' || (this.range < 8000.0 && this.currentDepth > 10.0);
    if (shouldBeUnderwater !== this.isUnderwater) {
      this.isUnderwater = shouldBeUnderwater;
      this.underwaterEnv.updateEnvironment(this.isUnderwater, this.currentDepth);
    }
  }

  private processKeyboardInput(dt: number): void {
    const panSpeed = (this.range / 10000000.0) * 0.04 * dt;
    const zoomSpeed = this.range * 0.8 * dt;
    const rotSpeed = 1.2 * dt;

    if (this.isShiftKey || this.isAltKey) {
      if (this.keyState.KeyA || this.keyState.ArrowLeft) {
        this.orbitVelocityHeading += rotSpeed;
      }
      if (this.keyState.KeyD || this.keyState.ArrowRight) {
        this.orbitVelocityHeading -= rotSpeed;
      }
      if (this.keyState.KeyW || this.keyState.ArrowUp) {
        this.orbitVelocityPitch += rotSpeed * 0.5;
      }
      if (this.keyState.KeyS || this.keyState.ArrowDown) {
        this.orbitVelocityPitch -= rotSpeed * 0.5;
      }
    } else {
      if (this.keyState.KeyW || this.keyState.ArrowUp) {
        this.panVelocityY += panSpeed;
      }
      if (this.keyState.KeyS || this.keyState.ArrowDown) {
        this.panVelocityY -= panSpeed;
      }
      if (this.keyState.KeyA || this.keyState.ArrowLeft) {
        this.panVelocityX -= panSpeed;
      }
      if (this.keyState.KeyD || this.keyState.ArrowRight) {
        this.panVelocityX += panSpeed;
      }
    }

    if (this.keyState.KeyQ) {
      this.zoomVelocity += zoomSpeed;
    }
    if (this.keyState.KeyE) {
      this.zoomVelocity -= zoomSpeed;
    }
  }

  /**
   * Translates the mathematical target + range + heading + pitch into the Cesium Camera matrix.
   */
  private getVerticalFramingOffsetMeters(): number {
    // UI overlays are positioned over the full-screen Cesium canvas. Keep the
    // globe centered in the unobscured vertical area instead of the raw canvas.
    const height = this.viewer.canvas.clientHeight || 1;
    let topInset = 0;
    let bottomInset = 0;
    if (typeof document !== 'undefined') {
      const header = document.querySelector('.header-controls, .underwater-header');
      const timeline = document.querySelector('.ocean-timeline-dock');
      if (header instanceof HTMLElement) topInset = Math.max(0, header.getBoundingClientRect().bottom);
      if (timeline instanceof HTMLElement) {
        const rect = timeline.getBoundingClientRect();
        if (rect.top < height) bottomInset = Math.max(0, height - rect.top);
      }
    }
    const globeLiftPixels = 180;
    
const pixelOffset = (topInset - bottomInset) * 0.5 - globeLiftPixels;
    if (Math.abs(pixelOffset) < 1) return 0;
    const frustum = this.viewer.camera.frustum;
    const fovy = ('fovy' in frustum ? frustum.fovy : undefined) ?? Cesium.Math.toRadians(60);
    const metersPerPixel = (2 * Math.max(this.range, 1000) * Math.tan(fovy / 2)) / Math.max(height, 1);
    return pixelOffset * metersPerPixel;
  }

  private applyCameraTransform(): void {
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(
      this.targetCartesian,
      Cesium.Ellipsoid.WGS84,
      this.scratchMatrix4
    );

    // Compute spherical position offset relative to target's East-North-Up frame
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);

    // Camera offset in target's local ENU coordinate frame:
    // x = East, y = North, z = Up
    const localOffset = new Cesium.Cartesian3(
      -this.range * cosP * sinH,
      -this.range * cosP * cosH,
      -this.range * sinP
    );

    // Transform local offset to world Cartesian coordinate
    const worldCameraPos = Cesium.Matrix4.multiplyByPoint(
      enuTransform,
      localOffset,
      this.scratchCartesian
    );

    // Aim at a slightly offset point so the globe is centered in the unobscured
    // viewport. The geographic target itself is never changed.
    const worldUp = Cesium.Matrix4.multiplyByPointAsVector(
      enuTransform,
      new Cesium.Cartesian3(0, 0, 1),
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(worldUp, worldUp);
    const framingOffset = this.getVerticalFramingOffsetMeters();
    const lookTarget = Cesium.Cartesian3.add(
      this.targetCartesian,
      Cesium.Cartesian3.multiplyByScalar(worldUp, framingOffset, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.subtract(
      lookTarget,
      worldCameraPos,
      this.scratchCartesian2
    );
    Cesium.Cartesian3.normalize(direction, direction);

    // Derive proper Up vector perpendicular to direction & East
    const upVector = new Cesium.Cartesian3(0, 0, 1);
    Cesium.Matrix4.multiplyByPointAsVector(
      enuTransform,
      upVector,
      worldUp
    );
    Cesium.Cartesian3.normalize(worldUp, worldUp);

    this.viewer.camera.setView({
      destination: worldCameraPos,
      orientation: {
        direction: direction,
        up: worldUp,
      },
    });
  }

  // ==========================================
  // CINEMATIC FLY-TO NAVIGATION ENGINE
  // ==========================================

  /**
   * Google Earth-Style Cinematic Great-Circle Fly-To navigation.
   * Rises to a sub-orbital arc for long distances, aligns heading/pitch, and settles smoothly.
   */
  public flyTo(options: CameraFlyToOptions): void {
    this.flyToActive = true;
    this.interactionMode = 'FLY_TO';
    this.flyToStartTime = performance.now() / 1000.0;
    this.flyToDuration = options.duration || 2.0;

    // Capture starting parameters
    this.flyToStartTarget = Cesium.Cartographic.clone(this.targetCartographic, this.flyToStartTarget);
    this.flyToEndTarget = Cesium.Cartographic.fromDegrees(
      options.longitude,
      options.latitude,
      0.0,
      this.flyToEndTarget
    );

    this.flyToStartRange = this.range;
    this.flyToEndRange = options.altitude || Math.max(1200000.0, this.range * 0.6);

    // Great-circle distance calculation for arc apex altitude
    const startPos = Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.flyToStartTarget, this.scratchCartesian);
    const endPos = Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.flyToEndTarget, this.scratchCartesian2);
    const chordDistance = Cesium.Cartesian3.distance(startPos, endPos);

    // Rise up to an apex proportional to travel distance (planetary arc)
    const arcHeight = chordDistance * 0.65;
    this.flyToApexRange = Math.max(this.flyToStartRange, this.flyToEndRange) + arcHeight;

    this.flyToStartHeading = this.heading;
    this.flyToEndHeading = options.heading !== undefined
      ? Cesium.Math.toRadians(options.heading)
      : this.heading;

    this.flyToStartPitch = this.pitch;
    this.flyToEndPitch = options.pitch !== undefined
      ? Cesium.Math.toRadians(options.pitch)
      : Cesium.Math.toRadians(-62.0);

    // Unwrapped shortest path for heading
    let dH = this.flyToEndHeading - this.flyToStartHeading;
    while (dH > Math.PI) dH -= 2 * Math.PI;
    while (dH < -Math.PI) dH += 2 * Math.PI;
    this.flyToEndHeading = this.flyToStartHeading + dH;

    this.flyToOnComplete = options.onComplete || null;

    // Reset velocities
    this.zoomVelocity = 0.0;
    this.panVelocityX = 0.0;
    this.panVelocityY = 0.0;
    this.orbitVelocityHeading = 0.0;
    this.orbitVelocityPitch = 0.0;
  }

  private updateFlyTo(currentTime: number): void {
    const elapsed = currentTime - this.flyToStartTime;
    const t = Math.min(1.0, elapsed / this.flyToDuration);

    // Smooth cubic Hermite ease-in-out curve
    const smoothT = t * t * (3.0 - 2.0 * t);

    // 1. Great-circle interpolation of geographic target
    this.targetCartographic.longitude =
      this.flyToStartTarget.longitude + (this.flyToEndTarget.longitude - this.flyToStartTarget.longitude) * smoothT;
    this.targetCartographic.latitude =
      this.flyToStartTarget.latitude + (this.flyToEndTarget.latitude - this.flyToStartTarget.latitude) * smoothT;
    Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.targetCartographic, this.targetCartesian);

    // 2. Arc flight altitude: rise smoothly to apex, then descend
    const parabola = 4.0 * t * (1.0 - t); // 0 at t=0, 1 at t=0.5, 0 at t=1
    const baseRange = this.flyToStartRange + (this.flyToEndRange - this.flyToStartRange) * smoothT;
    const apexBoost = Math.max(0.0, this.flyToApexRange - Math.max(this.flyToStartRange, this.flyToEndRange));
    this.range = baseRange + apexBoost * parabola;

    // 3. Orientation interpolation
    this.heading = this.flyToStartHeading + (this.flyToEndHeading - this.flyToStartHeading) * smoothT;
    this.pitch = this.flyToStartPitch + (this.flyToEndPitch - this.flyToStartPitch) * smoothT;

    if (t >= 1.0) {
      this.flyToActive = false;
      this.interactionMode = 'IDLE';
      if (this.flyToOnComplete) {
        this.flyToOnComplete();
        this.flyToOnComplete = null;
      }
    }
  }

  public cancelFlyTo(): void {
    if (this.flyToActive) {
      this.flyToActive = false;
      this.interactionMode = 'IDLE';
      this.flyToOnComplete = null;
    }
  }

  // ==========================================
  // REGION, OBSERVATION & OCEAN INTEGRATIONS
  // ==========================================

  /**
   * Fly directly to one of the 3 approved OCEAN-X geographic regions:
   * Bay of Bengal, Arabian Sea, or Southern Ocean.
   */
  public flyToRegion(regionId: string): void {
    const reg = UNDERWATER_REGIONS.find((r) => r.id === regionId || r.name.toLowerCase().includes(regionId.toLowerCase()));
    if (reg) {
      const centerLon = (reg.west + reg.east) * 0.5;
      const centerLat = (reg.south + reg.north) * 0.5;
      const isSO = reg.id === 'southern-ocean';
      const isIO = reg.id === 'indian-ocean';

      this.flyTo({
        latitude: isIO ? -12.0 : (isSO ? -70.0 : centerLat),
        longitude: isIO ? 80.0 : (isSO ? 65.0 : centerLon),
        altitude: isIO ? 7800000 : (isSO ? 4500000 : 1850000),
        heading: 0,
        pitch: isIO ? -65 : (isSO ? -70 : -58),
        duration: 2.2,
      });
    }
  }

  /**
   * Fly to an observation (Argo float or Glider) maintaining full rendering coherence.
   */
  public flyToObservation(longitude: number, latitude: number, duration = 1.8): void {
    const targetAlt = this.currentMode === 'underwater' ? 380000 : 850000;
    this.flyTo({
      latitude,
      longitude,
      altitude: targetAlt,
      heading: 10.0,
      pitch: this.currentMode === 'underwater' ? -42.0 : -55.0,
      duration,
    });
  }

  /**
   * Transitions camera between surface overview and underwater focused perspective.
   */
  public setMode(mode: OceanMode, depth = 0): void {
    this.currentMode = mode;
    this.currentDepth = depth;

    if (mode === 'surface') {
      this.flyTo({
        latitude: Cesium.Math.toDegrees(this.targetCartographic.latitude),
        longitude: Cesium.Math.toDegrees(this.targetCartographic.longitude),
        altitude: 3600000,
        heading: 0.0,
        pitch: -70.0,
        duration: 1.8,
      });
    } else {
      this.flyTo({
        latitude: Cesium.Math.toDegrees(this.targetCartographic.latitude) - 1.5,
        longitude: Cesium.Math.toDegrees(this.targetCartographic.longitude) - 1.5,
        altitude: 1450000,
        heading: 12.0,
        pitch: -48.0,
        duration: 1.8,
      });
    }
  }

  public setDepth(depth: number): void {
    this.currentDepth = depth;
    if (this.currentMode === 'underwater') {
      this.underwaterEnv.updateEnvironment(true, depth);
    }
  }

  public resetCamera(duration = 2.0): void {
    this.flyTo({
      latitude: 14.0,
      longitude: 75.0,
      altitude: 5000000,
      heading: 0.0,
      pitch: -72.0,
      duration,
    });
  }

  // ==========================================
  // DEBUG PANEL & TELEMETRY
  // ==========================================

  private setupDebugPanel(): void {
    if (typeof document === 'undefined') return;

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'ocean-x-camera-debug';
    this.debugPanel.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 280px;
      background: #111418;
      border: 1px solid #20242b;
      border-radius: 4px;
      padding: 12px 16px;
      color: #88909e;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      line-height: 1.6;
      z-index: 9999;
      pointer-events: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      display: none;
    `;
    document.body.appendChild(this.debugPanel);
  }

  public toggleDebug(): boolean {
    this.debugVisible = !this.debugVisible;
    if (this.debugPanel) {
      this.debugPanel.style.display = this.debugVisible ? 'block' : 'none';
    }
    return this.debugVisible;
  }

  private updateDebugPanel(): void {
    if (!this.debugVisible || !this.debugPanel) return;

    const snap = this.getStateSnapshot();
    this.debugPanel.innerHTML = `
      <div style="color: #f0f2f6; font-weight: bold; border-bottom: 1px solid #20242b; margin-bottom: 6px; padding-bottom: 2px;">
        ARIEL CAMERA ENGINE
      </div>
      <div>Lat: <span style="color:#f0f2f6">${snap.targetLatitude.toFixed(2)}°</span> Lon: <span style="color:#f0f2f6">${snap.targetLongitude.toFixed(2)}°</span></div>
      <div>Altitude: <span style="color:#f0f2f6">${(snap.range / 1000.0).toFixed(0)} km</span></div>
      <div>Heading: <span style="color:#f0f2f6">${snap.heading.toFixed(1)}°</span> Pitch: <span style="color:#f0f2f6">${snap.pitch.toFixed(1)}°</span></div>
      <div>Zoom Vel: <span style="color:#f0f2f6">${snap.zoomVelocity.toFixed(1)}</span></div>
      <div>Pan Vel: <span style="color:#f0f2f6">${(snap.panVelocityX * 1000).toFixed(2)}, ${(snap.panVelocityY * 1000).toFixed(2)}</span></div>
      <div>Mode: <span style="color:#2d5e94; font-weight: bold">${snap.mode}</span></div>
      <div>Environment: <span style="color:${snap.isUnderwater ? '#2d5e94' : '#88909e'}">${snap.isUnderwater ? 'UNDERWATER' : 'ATMOSPHERE'}</span></div>
      <div style="font-size: 9px; color: #505664; margin-top: 4px;">Press ~ or Ctrl+Shift+D to hide</div>
    `;
  }

  public getStateSnapshot(): CameraStateSnapshot {
    return {
      latitude: Cesium.Math.toDegrees(this.viewer.camera.positionCartographic.latitude),
      longitude: Cesium.Math.toDegrees(this.viewer.camera.positionCartographic.longitude),
      altitude: this.viewer.camera.positionCartographic.height,
      depth: this.currentDepth,
      targetLatitude: Cesium.Math.toDegrees(this.targetCartographic.latitude),
      targetLongitude: Cesium.Math.toDegrees(this.targetCartographic.longitude),
      range: this.range,
      heading: Cesium.Math.toDegrees(this.heading),
      pitch: Cesium.Math.toDegrees(this.pitch),
      roll: Cesium.Math.toDegrees(this.roll),
      zoomVelocity: this.zoomVelocity,
      panVelocityX: this.panVelocityX,
      panVelocityY: this.panVelocityY,
      orbitVelocityHeading: this.orbitVelocityHeading,
      orbitVelocityPitch: this.orbitVelocityPitch,
      mode: this.interactionMode,
      isUnderwater: this.isUnderwater,
    };
  }

  public destroy(): void {
    if (this.removePreRenderListener) {
      this.removePreRenderListener();
      this.removePreRenderListener = null;
    }
    for (const cleanup of this.domEventCleanups) {
      cleanup();
    }
    this.domEventCleanups = [];
    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }
  }
}
