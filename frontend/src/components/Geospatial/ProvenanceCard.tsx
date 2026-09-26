import React from 'react';
import type { ProvenanceMetadata } from '../../types/hazard';
import { ShieldCheck, Cpu, GitFork, Clock, Database, Globe2 } from 'lucide-react';

interface ProvenanceCardProps {
  metadata?: ProvenanceMetadata | null;
  className?: string;
}

export const ProvenanceCard: React.FC<ProvenanceCardProps> = ({ metadata, className = '' }) => {
  if (!metadata) return null;

  const getBadge = () => {
    switch (metadata.provenance) {
      case 'OFFICIAL':
        return {
          icon: <ShieldCheck size={14} />,
          label: 'OFFICIAL GOVERNMENT RECORD',
          cls: 'badge-official',
        };
      case 'MODEL':
        return {
          icon: <Cpu size={14} />,
          label: 'NUMERICAL OCEAN MODEL',
          cls: 'badge-model',
        };
      case 'DERIVED':
        return {
          icon: <GitFork size={14} />,
          label: 'DERIVED ALGORITHMIC PRODUCT',
          cls: 'badge-derived',
        };
      default:
        return {
          icon: <Database size={14} />,
          label: metadata.provenance,
          cls: 'badge-model',
        };
    }
  };

  const badge = getBadge();

  return (
    <div className={`provenance-card ${className}`}>
      <div className="provenance-header">
        <div className="provenance-title">
          <Database size={14} style={{ color: '#5bb0f5' }} />
          <span>SCIENTIFIC PROVENANCE AUDIT</span>
        </div>
        <div className={`provenance-badge ${badge.cls}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      </div>

      <div className="provenance-grid">
        <div>
          <span className="provenance-item-label">Primary Provider</span>
          <span className="provenance-item-val">{metadata.source}</span>
        </div>

        <div>
          <span className="provenance-item-label">Dataset / Catalog ID</span>
          <span className="provenance-item-val" style={{ color: '#5bb0f5' }}>{metadata.dataset}</span>
        </div>

        <div>
          <span className="provenance-item-label">Processing Level & Resolution</span>
          <span className="provenance-item-val">
            {metadata.processing_level || 'L4 Analyzed'} &bull; {metadata.resolution || '0.083° (~9 km)'}
          </span>
        </div>

        <div>
          <span className="provenance-item-label">Observation Timestamp</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#c5c9d2' }}>
            <Clock size={12} style={{ color: '#88909e' }} />
            <span>{new Date(metadata.timestamp).toUTCString()}</span>
          </div>
        </div>
      </div>

      {metadata.region && (
        <div className="provenance-footer">
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Globe2 size={12} style={{ color: '#5bb0f5' }} /> Scope: {metadata.region}
          </span>
          {metadata.valid_to && <span>Valid Thru: {metadata.valid_to}</span>}
        </div>
      )}
    </div>
  );
};
