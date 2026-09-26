import React, {
  useEffect,
  useState,
} from 'react';

import { OceanState } from '../../ocean/OceanState';

import type {
  OceanVariable,
} from '../../types/ocean';

import {
  Layers,
  Thermometer,
  Droplets,
  Wind,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CheckpointData {
  depth: number;
  label: string;
  value: number;
  unit: string;
}

const DEPTH_LEVELS = [
  { depth: 0, label: '0m Surface' },
  { depth: 100, label: '100m Mixed Layer' },
  { depth: 200, label: '200m Thermocline' },
  { depth: 300, label: '300m Upper Pycnocline' },
  { depth: 400, label: '400m Mid Pycnocline' },
  { depth: 500, label: '500m Mesopelagic' },
  { depth: 750, label: '750m Intermediate' },
  { depth: 1000, label: '1000m Bathypelagic' },
  { depth: 1500, label: '1500m Deep Ocean' },
  { depth: 2000, label: '2000m Abyssal Plain' },
];

export const WaterColumn: React.FC = () => {
  const [selectedDepth, setSelectedDepth] =
    useState(0);

  const [activeVar, setActiveVar] =
    useState<OceanVariable>(
      'temperature',
    );

  const [checkpoints, setCheckpoints] =
    useState<CheckpointData[]>([]);

  const [collapsed, setCollapsed] =
    useState(false);

  useEffect(() => {
    const state =
      OceanState.getInstance();

    const unsub =
      state.subscribe(
        (snapshot) => {
          setSelectedDepth(
            snapshot.parameters.depth,
          );

          setActiveVar(
            snapshot.activeVariable,
          );

          const sampled =
            DEPTH_LEVELS.map(
              (level) => {
                const field =
                  state.sampleSpatialField(
                    14,
                    66,
                    level.depth,
                  );

                let value =
                  field.temperature;

                let unit =
                  '°C';

                if (
                  snapshot.activeVariable ===
                  'salinity'
                ) {
                  value =
                    field.salinity;

                  unit =
                    'PSU';
                } else if (
                  snapshot.activeVariable ===
                  'current'
                ) {
                  const u = field.velocity?.u ?? 0;
                  const v = field.velocity?.v ?? 0;
                  value = Math.sqrt(u ** 2 + v ** 2);

                  unit =
                    'm/s';
                } else if (
                  snapshot.activeVariable ===
                  'chlorophyll'
                ) {
                  value =
                    field.chlorophyll;

                  unit =
                    'mg/m³';
                }

                const safeVal = Number.isFinite(value)
                  ? value
                  : snapshot.activeVariable === 'salinity'
                  ? 35.0
                  : snapshot.activeVariable === 'chlorophyll'
                  ? 0.8
                  : snapshot.activeVariable === 'current'
                  ? 0.5
                  : Math.max(2.5, 28.0 - level.depth * 0.015);

                return {
                  depth:
                    level.depth,

                  label:
                    level.label,

                  value:
                    parseFloat(
                      safeVal.toFixed(
                        2,
                      ),
                    ),

                  unit,
                };
              },
            );

          setCheckpoints(
            sampled,
          );
        },
      );

    return unsub;
  }, []);

  const handleSelectDepth = (
    depth: number,
  ) => {
    OceanState
      .getInstance()
      .setDepth(depth);
  };

  const getVarIcon = () => {
    switch (activeVar) {
      case 'salinity':
        return (
          <Droplets
            size={14}
            className="icon-blue"
          />
        );

      case 'current':
        return (
          <Wind
            size={14}
            className="icon-cyan"
          />
        );

      case 'chlorophyll':
        return (
          <Sparkles
            size={14}
            className="icon-green"
          />
        );

      default:
        return (
          <Thermometer
            size={14}
            className="icon-amber"
          />
        );
    }
  };

  return (
    <aside
      className={`ocean-panel water-column-panel ${
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
              <Layers
                className="icon-teal"
                size={16}
              />

              <h2 className="panel-title">
                WATER COLUMN PROFILE
              </h2>
            </div>

            <div className="var-mini-tag">
              {getVarIcon()}

              <span className="var-mini-name">
                {activeVar.toUpperCase()}
              </span>
            </div>
          </>
        )}

        {/* THE ONLY COLLAPSE BUTTON */}
        <button
          type="button"
          onClick={() =>
            setCollapsed(
              (value) => !value,
            )
          }
          title={
            collapsed
              ? 'Expand Water Column'
              : 'Collapse Water Column'
          }
          aria-label={
            collapsed
              ? 'Expand Water Column'
              : 'Collapse Water Column'
          }
          className="underwater-panel-collapse-button"
        >
          {collapsed ? (
            <ChevronRight
              size={14}
            />
          ) : (
            <ChevronLeft
              size={14}
            />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="water-column-list">
          {checkpoints.map(
            (cp) => {
              const isCurrentSlice =
                Math.abs(
                  selectedDepth -
                    cp.depth,
                ) <= 40;

              const isExact =
                selectedDepth ===
                cp.depth;

              return (
                <div
                  key={cp.depth}
                  onClick={() =>
                    handleSelectDepth(
                      cp.depth,
                    )
                  }
                  className={`water-column-row ${
                    isCurrentSlice
                      ? 'row-active-slice'
                      : ''
                  } ${
                    isExact
                      ? 'row-exact-depth'
                      : ''
                  }`}
                >
                  <div className="row-depth-label">
                    <span className="depth-bullet" />

                    <span className="depth-text">
                      -{cp.depth}m
                    </span>
                  </div>

                  <div className="row-bar-track">
                    <div
                      className="row-bar-fill"
                      style={{
                        width: `${
                          Math.min(
                            100,
                            Math.max(
                              10,
                              activeVar ===
                                'temperature'
                                ? ((Number.isFinite(cp.value) ? cp.value : 18) /
                                    32) *
                                    100
                                : ((Number.isFinite(cp.value) ? cp.value : 35) /
                                    40) *
                                    100,
                            ),
                          )
                        }%`,

                        background:
                          activeVar ===
                          'temperature'
                            ? 'linear-gradient(90deg, #2d5e94, #f59e0b)'
                            : activeVar ===
                              'salinity'
                            ? 'linear-gradient(90deg, #2d5e94, #38bdf8)'
                            : '#2d5e94',
                      }}
                    />
                  </div>

                  <div className="row-val-group">
                    <span className="row-val-num">
                      {Number.isFinite(cp.value) ? cp.value.toFixed(2) : '—'}
                    </span>

                    <span className="row-val-unit">
                      {cp.unit}
                    </span>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </aside>
  );
};