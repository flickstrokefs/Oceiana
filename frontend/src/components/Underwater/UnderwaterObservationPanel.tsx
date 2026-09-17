import React, {
  useEffect,
  useState,
} from 'react';

import { OceanState } from '../../ocean/OceanState';

import type {
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';

import {
  Radio,
  Navigation,
  Eye,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export const UnderwaterObservationPanel: React.FC =
  () => {
    const [argoList, setArgoList] =
      useState<ArgoProfile[]>([]);

    const [gliderList, setGliderList] =
      useState<GliderTrajectory[]>([]);

    const [currentDepth, setCurrentDepth] =
      useState<number>(0);

    const [collapsed, setCollapsed] =
      useState(false);

    useEffect(() => {
      const oceanState =
        OceanState.getInstance();

      const provider =
        oceanState.getProvider();

      const initialArgo = oceanState.getArgoProfiles();
      if (initialArgo.length > 0) {
        setArgoList(initialArgo);
      } else {
        setArgoList(provider.getArgoProfiles());
      }

      const initialGliders = oceanState.getGliders();
      if (initialGliders.length > 0) {
        setGliderList(initialGliders);
      } else {
        setGliderList(provider.getGliderTrajectories());
      }

      const unsub = oceanState.subscribe((snapshot) => {
        setCurrentDepth(snapshot.parameters.depth);
        if (snapshot.gliders && snapshot.gliders.length > 0) {
          setGliderList(snapshot.gliders);
        }
        if (snapshot.argoProfiles && snapshot.argoProfiles.length > 0) {
          setArgoList(snapshot.argoProfiles);
        }
      });

      return unsub;
    }, []);

    const handleSelectArgo = (argo: ArgoProfile) => {
      OceanState.getInstance().selectObservation({
        type: 'argo',
        data: argo,
      });
      OceanState.getInstance().requestFlyToLocation(argo.latitude, argo.longitude, 650000);
    };

    const handleSelectGlider = (glider: GliderTrajectory) => {
      OceanState.getInstance().selectObservation({
        type: 'glider',
        data: glider,
      });
      const latest = glider.waypoints[glider.waypoints.length - 1];
      if (latest) {
        OceanState.getInstance().requestFlyToLocation(latest.latitude, latest.longitude, 650000);
      }
    };

    return (
      <div
        className={`ocean-panel underwater-obs-panel ${
          collapsed
            ? 'in-situ-panel-collapsed'
            : ''
        }`}
      >
        {/* =================================
            IN-SITU HEADER
            ================================= */}

        <div className="panel-header">
          {!collapsed && (
            <>
              <div className="panel-title-group">
                <Radio
                  className="icon-cyan animate-pulse-slow"
                  size={16}
                />

                <h2 className="panel-title">
                  IN-SITU OBSERVATORIES
                </h2>
              </div>

              <span className="badge-live">
                {argoList.length +
                  gliderList.length}{' '}
                ACTIVE
              </span>
            </>
          )}

          {/* ONLY IN-SITU COLLAPSE BUTTON */}
          <button
            type="button"
            className="in-situ-collapse-button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setCollapsed(
                (previous) => !previous,
              );
            }}
            title={
              collapsed
                ? 'Expand In-Situ Observatories'
                : 'Collapse In-Situ Observatories'
            }
            aria-label={
              collapsed
                ? 'Expand In-Situ Observatories'
                : 'Collapse In-Situ Observatories'
            }
          >
            {collapsed ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>

        {/* =================================
            CONTENT
            ================================= */}

        {!collapsed && (
          <>
            <div className="obs-summary-text">
              <span>
                Argo CTD profiles & deep
                gliders intersecting
                Stratum -{currentDepth}m:
              </span>
            </div>

            <div className="obs-units-list">
              {/* ==========================
                  ARGO
                  ========================== */}

              {argoList.map(
                (argo) => {
                  const nodes = argo.nodes || [];
                  let nearestNode =
                    nodes[0] || { depth: 0, temperature: 0, salinity: 0 };

                  let minDiff =
                    Infinity;

                  for (
                    const n of nodes
                  ) {
                    const diff =
                      Math.abs(
                        n.depth -
                          currentDepth,
                      );

                    if (
                      diff <
                      minDiff
                    ) {
                      minDiff = diff;
                      nearestNode = n;
                    }
                  }

                  return (
                    <div
                      key={argo.id}
                      onClick={() =>
                        handleSelectArgo(
                          argo,
                        )
                      }
                      className="obs-unit-card"
                      title="Click to view CTD Vertical Profile"
                    >
                      <div className="obs-card-top">
                        <div className="obs-card-name">
                          <span className="obs-dot dot-argo" />

                          <span className="obs-name-text">
                            {
                              argo.stationCode
                            }
                          </span>
                        </div>

                        <button
                          type="button"
                          className="view-profile-mini-btn"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            handleSelectArgo(
                              argo,
                            );
                          }}
                        >
                          <Eye size={12} />

                          <span>
                            PROFILE
                          </span>
                        </button>
                      </div>

                      <div className="obs-card-telemetry">
                        <div className="telemetry-chip">
                          <span className="chip-label">
                            NODE @ -
                            {
                              nearestNode.depth
                            }
                            m:
                          </span>

                          <span className="chip-val font-mono">
                            {
                              nearestNode.temperature
                            }
                            °C /{' '}
                            {
                              nearestNode.salinity
                            }{' '}
                            PSU
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                },
              )}

              {/* ==========================
                  GLIDERS
                  ========================== */}

              {gliderList.map(
                (glider) => (
                  <div
                    key={glider.id}
                    onClick={() =>
                      handleSelectGlider(
                        glider,
                      )
                    }
                    className="obs-unit-card"
                    title="Click to view Glider Mission Track"
                  >
                    <div className="obs-card-top">
                      <div className="obs-card-name">
                        <span className="obs-dot dot-glider" />

                        <span className="obs-name-text">
                          {
                            glider.name
                          }
                        </span>
                      </div>

                      <button
                        type="button"
                        className="view-profile-mini-btn"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          handleSelectGlider(
                            glider,
                          );
                        }}
                      >
                        <Navigation
                          size={12}
                        />

                        <span>
                          TRACK
                        </span>
                      </button>
                    </div>

                    <div className="obs-card-telemetry">
                      <div className="telemetry-chip">
                        <span className="chip-label">
                          MISSION:
                        </span>

                        <span className="chip-val font-mono">
                          {
                            glider.mission
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>
    );
  };

export default UnderwaterObservationPanel;