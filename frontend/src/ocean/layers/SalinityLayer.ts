import type * as Cesium from 'cesium';
import { DepthSliceRenderer } from './DepthSliceRenderer';

/**
 * SalinityLayer adapter delegating to unified DepthSliceRenderer
 */
export class SalinityLayer {
  private renderer: DepthSliceRenderer;

  constructor(viewer: Cesium.Viewer, renderer?: DepthSliceRenderer) {
    this.renderer = renderer || new DepthSliceRenderer(viewer);
  }

  public update(): void {
    this.renderer.update();
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.renderer.setVariable('salinity');
    }
  }

  public destroy(): void {
    // Lifecycle managed by DepthSliceRenderer
  }
}
