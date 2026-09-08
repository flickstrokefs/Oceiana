import type * as Cesium from 'cesium';
import type { OceanVariable, UnderwaterRegionId } from '../../types/ocean';

/**
 * UnderwaterDepthPointsLayer
 * Maintained for interface compatibility with OceanEngine.
 * Regional underwater data points are now independently queried and visualized
 * directly within each UnderwaterRegionBox container via fetchUnderwaterRegionData().
 */
export class UnderwaterDepthPointsLayer {
  constructor(_viewer: Cesium.Viewer) {}

  public filterByDepth(
    _depth: number,
    _variable?: OceanVariable,
    _regionId?: UnderwaterRegionId | null
  ): void {}

  public setRegion(_regionId: UnderwaterRegionId | null): void {}

  public setVisible(_visible: boolean): void {}

  public destroy(): void {}
}
