import * as Cesium from 'cesium';

import { OceanState } from '../OceanState';

import {
  OCEAN_DOMAINS,
  UNDERWATER_REGIONS,
  type OceanDomainId,
} from '../../types/ocean';

import {
  ARABIAN_SEA_SUBREGIONS,
} from '../ArabianSeaSubregions';

import { geoToWorld } from '../utils/underwaterCoords';


/**
 * ============================================================================
 * ARIEL — OCEAN DOMAIN + ARABIAN SEA SECTOR OVERLAY
 * ============================================================================
 *
 * Responsibilities:
 *
 * 1. Keep existing IHO ocean-domain boundaries untouched.
 * 2. Show Arabian Sea internal ARIEL sectors only when Arabian Sea is active.
 * 3. Render sector names.
 * 4. Keep sector lines visually subordinate to the real cyan outer boundary.
 *
 * IMPORTANT:
 * This class does NOT modify:
 *
 * - UNDERWATER_REGIONS
 * - the Arabian Sea IHO footprint
 * - Argo observations
 * - Glider observations
 * - underwater volume mesh
 *
 * ============================================================================
 */

export class OceanDomainLayer {

  private viewer: Cesium.Viewer;

  private entities: Cesium.Entity[] = [];

  private sectorEntities: Cesium.Entity[] = [];

  private handler:
    Cesium.ScreenSpaceEventHandler | null = null;

  private unsubscribeState:
    (() => void) | null = null;

  private visible = false;

  private destroyed = false;


  constructor(viewer: Cesium.Viewer) {

    this.viewer = viewer;

    this.createDomainBorders();

    this.createArabianSeaSectors();

    this.initInteraction();

    this.bindState();
  }


  // ==========================================================================
  // EXISTING OCEAN DOMAIN BORDERS
  // ==========================================================================

  private createDomainBorders(): void {

    for (const domain of OCEAN_DOMAINS) {

      const positions =
        domain.footprint.map(
          ([longitude, latitude]) =>
            geoToWorld(
              longitude,
              latitude,
              0,
            ),
        );

      if (positions.length === 0) {
        continue;
      }

      positions.push(
        positions[0],
      );

      const border =
        this.viewer.entities.add({

          polyline: {

            positions,

            width: 3,

            arcType:
              Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.0,
                  0.85,
                  1.0,
                  0.9,
                ),
              ),
          },

          properties: {
            oceanDomain:
              domain.id,
          },
        });

      border.show = false;

      this.entities.push(
        border,
      );
    }
  }


  // ==========================================================================
  // ARABIAN SEA INTERNAL SECTORS
  // ==========================================================================

  private createArabianSeaSectors(): void {

    /*
     * We intentionally use the real Arabian Sea footprint as the reference
     * boundary.
     *
     * The mock sectors themselves remain the green visualization layer.
     */

    const arabianSea =
      UNDERWATER_REGIONS.find(
        (region) =>
          region.id === 'arabian-sea',
      );

    if (!arabianSea) {

      console.warn(
        '[ARIEL] Arabian Sea footprint not found.',
      );

      return;
    }


    for (
      const sector
      of ARABIAN_SEA_SUBREGIONS
    ) {

      const coordinates =
        this.keepInsideArabianSea(
          sector.coordinates,
          arabianSea.footprint,
        );

      if (
        coordinates.length < 3
      ) {
        continue;
      }


      const positions =
        coordinates.map(
          ([longitude, latitude]) =>
            geoToWorld(
              longitude,
              latitude,
              0,
            ),
        );


      positions.push(
        positions[0],
      );


      // ================================================================
      // GREEN SECTOR BORDER
      // ================================================================

      const border =
        this.viewer.entities.add({

          polyline: {

            positions,

            width: 2.5,

            arcType:
              Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.15,
                  1.0,
                  0.35,
                  0.95,
                ),
              ),

            clampToGround: false,
          },

          properties: {

            arabianSeaSector:
              sector.id,

            sectorName:
              sector.name,
          },
        });


      border.show = false;

      this.sectorEntities.push(
        border,
      );


      // ================================================================
      // VERY LIGHT INTERNAL FILL
      // ================================================================

      const surface =
        this.viewer.entities.add({

          polygon: {

            hierarchy:
              new Cesium.PolygonHierarchy(
                positions,
              ),

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.05,
                  0.8,
                  0.2,
                  0.025,
                ),
              ),

            perPositionHeight: true,

            arcType:
              Cesium.ArcType.NONE,
          },

          properties: {

            arabianSeaSector:
              sector.id,

            sectorName:
              sector.name,
          },
        });


      surface.show = false;

      this.sectorEntities.push(
        surface,
      );


      // ================================================================
      // SECTOR NAME
      // ================================================================

      /*
       * THIS is what was missing from your current result.
       *
       * The label is placed at the center supplied by the sector definition.
       */

      const labelPosition =
        geoToWorld(
          sector.center.longitude,
          sector.center.latitude,
          250,
        );


      const label =
        this.viewer.entities.add({

          position:
            labelPosition,

          label: {

            text:
              sector.name,

            font:
              'bold 18px sans-serif',

            fillColor:
              new Cesium.Color(
                0.55,
                1.0,
                0.65,
                1.0,
              ),

            outlineColor:
              new Cesium.Color(
                0.0,
                0.05,
                0.02,
                0.95,
              ),

            outlineWidth: 5,

            style:
              Cesium.LabelStyle.FILL_AND_OUTLINE,

            horizontalOrigin:
              Cesium.HorizontalOrigin.CENTER,

            verticalOrigin:
              Cesium.VerticalOrigin.CENTER,

            heightReference:
              Cesium.HeightReference.NONE,

            disableDepthTestDistance:
              Number.POSITIVE_INFINITY,

            scaleByDistance:
              new Cesium.NearFarScalar(
                500000,
                1.0,
                3000000,
                0.72,
              ),

            translucencyByDistance:
              new Cesium.NearFarScalar(
                1000000,
                1.0,
                5000000,
                0.8,
              ),
          },

          properties: {

            arabianSeaSector:
              sector.id,

            sectorName:
              sector.name,
          },
        });


      label.show = false;

      this.sectorEntities.push(
        label,
      );
    }


    console.log(
      `[ARIEL] Created ${ARABIAN_SEA_SUBREGIONS.length} Arabian Sea sector overlays.`,
    );
  }


  // ==========================================================================
  // KEEP MOCK GEOMETRY INSIDE REAL ARABIAN SEA
  // ==========================================================================

  private keepInsideArabianSea(
    coordinates: [number, number][],
    boundary: [number, number][],
  ): [number, number][] {

    /*
     * IMPORTANT:
     *
     * We do NOT replace the real boundary.
     *
     * Instead, each mock sector is tested against the real Arabian Sea
     * footprint.
     *
     * For the presentation visualization we retain vertices that are safely
     * inside the actual IHO footprint.
     *
     * The mock coordinates were already deliberately kept away from the
     * coastline. This additional check prevents the problematic outward
     * vertices from being displayed.
     */

    if (
      boundary.length < 3
    ) {
      return coordinates;
    }


    const result:
      [number, number][] = [];


    for (
      const point
      of coordinates
    ) {

      if (
        this.pointInsidePolygon(
          point,
          boundary,
        )
      ) {

        result.push(point);
      }
    }


    /*
     * If the polygon has too few retained points, use the original geometry.
     *
     * This prevents an accidental disappearance if the IHO boundary contains
     * a very detailed coastline segment.
     */

    if (
      result.length < 3
    ) {

      return coordinates;
    }


    return result;
  }


  // ==========================================================================
  // POINT-IN-POLYGON
  // ==========================================================================

  private pointInsidePolygon(
    point: [number, number],
    polygon: [number, number][],
  ): boolean {

    const x =
      point[0];

    const y =
      point[1];

    let inside = false;


    for (
      let i = 0,
      j = polygon.length - 1;

      i < polygon.length;

      j = i++
    ) {

      const xi =
        polygon[i][0];

      const yi =
        polygon[i][1];

      const xj =
        polygon[j][0];

      const yj =
        polygon[j][1];


      const intersects =
        (
          yi > y
        ) !==
        (
          yj > y
        )
        &&
        x <
        (
          (xj - xi)
          *
          (y - yi)
          /
          ((yj - yi) || 0.0000001)
        )
        +
        xi;


      if (
        intersects
      ) {

        inside =
          !inside;
      }
    }


    return inside;
  }


  // ==========================================================================
  // STATE
  // ==========================================================================

  private bindState(): void {

    const state =
      OceanState.getInstance();


    this.unsubscribeState =
      state.subscribe(
        (snapshot) => {

          const isArabianSea =
            snapshot.underwaterRegion ===
            'arabian-sea';


          this.setArabianSeaSubregionsVisible(
            this.visible &&
            isArabianSea,
          );
        },
      );
  }


  // ==========================================================================
  // INTERACTION
  // ==========================================================================

  private initInteraction(): void {

    this.handler =
      new Cesium.ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );


    this.handler.setInputAction(
      (
        click: {
          position: Cesium.Cartesian2;
        },
      ) => {

        if (
          !this.visible ||
          this.destroyed ||
          this.viewer.isDestroyed()
        ) {
          return;
        }


        const picked =
          this.viewer.scene.pick(
            click.position,
          );


        if (
          !Cesium.defined(
            picked,
          )
          ||
          !picked.id
          ||
          !picked.id.properties
        ) {
          return;
        }


        const property =
          picked.id.properties
            .oceanDomain;


        if (!property) {
          return;
        }


        const domain =
          property.getValue() as OceanDomainId;

        if (!domain) {
          return;
        }


        OceanState
          .getInstance()
          .setOceanDomain(
            domain,
          );
      },

      Cesium.ScreenSpaceEventType
        .LEFT_CLICK,
    );
  }


  // ==========================================================================
  // VISIBILITY
  // ==========================================================================

  public setArabianSeaSubregionsVisible(
    visible: boolean,
  ): void {

    for (
      const entity
      of this.sectorEntities
    ) {

      entity.show =
        visible;
    }


    if (visible) {

      console.log(
        '[ARIEL] Arabian Sea sector mesh + labels: VISIBLE',
      );
    }
  }


  public setVisible(
    visible: boolean,
  ): void {

    this.visible =
      visible;


    for (
      const entity
      of this.entities
    ) {

      entity.show =
        visible;
    }


    const state =
      OceanState.getInstance();


    const snapshot =
      state.getSnapshot();


    this.setArabianSeaSubregionsVisible(
      visible &&
      snapshot.underwaterRegion ===
        'arabian-sea',
    );
  }


  // ==========================================================================
  // DESTROY
  // ==========================================================================

  public destroy(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.destroyed =
      true;


    if (
      this.handler
    ) {

      this.handler.destroy();

      this.handler =
        null;
    }


    if (
      this.unsubscribeState
    ) {

      this.unsubscribeState();

      this.unsubscribeState =
        null;
    }


    for (
      const entity
      of this.entities
    ) {

      this.viewer.entities.remove(
        entity,
      );
    }


    for (
      const entity
      of this.sectorEntities
    ) {

      this.viewer.entities.remove(
        entity,
      );
    }


    this.entities = [];

    this.sectorEntities = [];
  }
}