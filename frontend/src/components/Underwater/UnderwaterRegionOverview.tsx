import React, { useEffect, useState } from 'react';

import { OceanState } from '../../ocean/OceanState';

import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
} from '../../types/ocean';

export const UnderwaterRegionOverview: React.FC = () => {
  const [activeRegion, setActiveRegion] =
    useState<UnderwaterRegionId | null>(null);

  useEffect(() => {
    const oceanState =
      OceanState.getInstance();

    const update = () => {
      const snapshot =
        oceanState.getSnapshot();

      setActiveRegion(
        snapshot.underwaterRegion,
      );
    };

    update();

    return oceanState.subscribe(
      update,
    );
  }, []);

  /*
   * Once a water body has been selected,
   * the popup disappears.
   */
  if (activeRegion !== null) {
    return null;
  }

  const regions =
    UNDERWATER_REGIONS.filter(
      (region) =>
        region.id !== 'southern-ocean' &&
        region.id !== 'indian-ocean',
    );

  const handleSelect = (
    regionId: UnderwaterRegionId,
  ) => {
    OceanState
      .getInstance()
      .setUnderwaterRegion(
        regionId,
      );
  };

  return (
    <div className="underwater-region-overview-overlay">
      <div className="underwater-region-overview">
        <div className="underwater-region-overview-header">
          <div>
            <span className="underwater-region-kicker">
              INDIAN OCEAN
            </span>

            <h2>Select Water Body</h2>

            <p>
              Select a water body to open
              its underwater 3D field.
            </p>
          </div>
        </div>

        <div className="underwater-region-grid">
          {regions.map(
            (region, index) => (
              <button
                key={region.id}
                type="button"
                className="underwater-region-card"
                onClick={() =>
                  handleSelect(
                    region.id,
                  )
                }
              >
                <div className="underwater-region-card-index">
                  {String(
                    index + 1,
                  ).padStart(2, '0')}
                </div>

                <div className="underwater-region-card-content">
                  <h3>
                    {region.name}
                  </h3>

                  <p>
                    {region.description}
                  </p>

                  <span className="underwater-region-card-action">
                    OPEN FIELD →
                  </span>
                </div>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

export default UnderwaterRegionOverview;