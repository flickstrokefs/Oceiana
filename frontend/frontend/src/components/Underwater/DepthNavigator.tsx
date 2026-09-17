import React, {
  useEffect,
  useState,
} from 'react';

import { OceanState } from '../../ocean/OceanState';

import {
  Waves,
  ChevronsUp,
  ChevronsDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const DepthNavigator: React.FC =
  () => {
    const [depth, setDepth] =
      useState(0);

    const [collapsed, setCollapsed] =
      useState(false);

    const minDepth = 0;
    const maxDepth = 2000;
    const tolerance = 40;

    useEffect(() => {
      const unsub =
        OceanState
          .getInstance()
          .subscribe(
            (snapshot) => {
              setDepth(
                snapshot.parameters.depth,
              );
            },
          );

      return unsub;
    }, []);

    const handleDepthChange =
      (
        newDepth: number,
      ) => {
        const clamped =
          Math.min(
            maxDepth,
            Math.max(
              minDepth,
              newDepth,
            ),
          );

        setDepth(clamped);

        OceanState
          .getInstance()
          .setDepth(
            clamped,
          );
      };

    const depthPresets = [
      {
        label: 'Surface',
        value: 0,
        tag: '0m',
      },
      {
        label: 'Epipelagic',
        value: 100,
        tag: '100m',
      },
      {
        label: 'Thermocline',
        value: 200,
        tag: '200m',
      },
      {
        label: 'Mesopelagic',
        value: 500,
        tag: '500m',
      },
      {
        label: 'Bathypelagic',
        value: 1000,
        tag: '1000m',
      },
      {
        label: 'Abyssal',
        value: 2000,
        tag: '2000m',
      },
    ];

    return (
      <aside
        className={`ocean-panel depth-navigator-panel ${
          collapsed
            ? 'underwater-side-panel-collapsed'
            : ''
        }`}
      >
        <div
          className="panel-header"
          style={{
            position: 'relative',
          }}
        >
          {!collapsed && (
            <>
              <div className="panel-title-group">
                <Waves
                  className="icon-cyan animate-pulse-slow"
                  size={18}
                />

                <h2 className="panel-title">
                  DEPTH NAVIGATOR
                </h2>
              </div>

              <span className="badge-live">
                3D SLICE
              </span>
            </>
          )}

          {/* ONLY ONE COLLAPSE BUTTON */}
          <button
            type="button"
            onClick={() =>
              setCollapsed(
                (value) =>
                  !value,
              )
            }
            title={
              collapsed
                ? 'Expand Depth Navigator'
                : 'Collapse Depth Navigator'
            }
            aria-label={
              collapsed
                ? 'Expand Depth Navigator'
                : 'Collapse Depth Navigator'
            }
            className="underwater-panel-collapse-button"
          >
            {collapsed ? (
              <ChevronLeft
                size={14}
              />
            ) : (
              <ChevronRight
                size={14}
              />
            )}
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="depth-readout-card">

              <div className="depth-primary-row">
                <span className="depth-number-val">
                  -{depth}
                </span>

                <span className="depth-number-unit">
                  m
                </span>
              </div>

              <div className="depth-tolerance-badge">
                <span className="tolerance-label">
                  TOLERANCE:
                </span>

                <span className="tolerance-val">
                  ±{tolerance}m
                </span>

                <span className="tolerance-range">
                  (
                  {Math.max(
                    0,
                    depth -
                      tolerance,
                  )}
                  m —{' '}
                  {depth +
                    tolerance}
                  m)
                </span>
              </div>

            </div>

            <div className="vertical-depth-track-container">

              <div className="depth-scale-labels">
                <span>
                  0m
                </span>

                <span>
                  500m
                </span>

                <span>
                  1000m
                </span>

                <span>
                  1500m
                </span>

                <span>
                  2000m
                </span>
              </div>

              <div className="vertical-slider-wrapper">

                <input
                  type="range"
                  min={
                    minDepth
                  }
                  max={
                    maxDepth
                  }
                  step={10}
                  value={
                    depth
                  }
                  onChange={(
                    event,
                  ) =>
                    handleDepthChange(
                      parseInt(
                        event
                          .target
                          .value,
                        10,
                      ),
                    )
                  }
                  className="vertical-depth-slider"
                  style={{
                    background:
                      `linear-gradient(to right, #2d5e94 0%, #2d5e94 ${
                        (
                          depth /
                          maxDepth
                        ) *
                        100
                      }%, rgba(255,255,255,0.1) ${
                        (
                          depth /
                          maxDepth
                        ) *
                        100
                      }%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />

              </div>

              <div className="depth-step-controls">

                <button
                  type="button"
                  onClick={() =>
                    handleDepthChange(
                      depth -
                        50,
                    )
                  }
                  disabled={
                    depth <=
                    minDepth
                  }
                  className="depth-step-btn"
                >
                  <ChevronsUp
                    size={14}
                  />

                  +50m (Up)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDepthChange(
                      depth +
                        50,
                    )
                  }
                  disabled={
                    depth >=
                    maxDepth
                  }
                  className="depth-step-btn"
                >
                  <ChevronsDown
                    size={14}
                  />

                  -50m (Down)
                </button>

              </div>

            </div>

            <div className="depth-presets-section">

              <span className="preset-title">
                STRATIFIED CHECKPOINTS
              </span>

              <div className="depth-preset-buttons">

                {depthPresets.map(
                  (
                    preset,
                  ) => {
                    const selected =
                      Math.abs(
                        depth -
                          preset.value,
                      ) <=
                      25;

                    return (
                      <button
                        type="button"
                        key={
                          preset.value
                        }
                        onClick={() =>
                          handleDepthChange(
                            preset.value,
                          )
                        }
                        className={`depth-preset-item ${
                          selected
                            ? 'depth-preset-active'
                            : ''
                        }`}
                      >
                        <span className="preset-name">
                          {
                            preset.label
                          }
                        </span>

                        <span className="preset-depth">
                          {
                            preset.tag
                          }
                        </span>
                      </button>
                    );
                  },
                )}

              </div>

            </div>
          </>
        )}
      </aside>
    );
  };