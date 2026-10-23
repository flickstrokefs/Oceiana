import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface ReportMeta {
  type: string;
  title: string;
  description: string;
  provenance: string;
}

const REPORT_TYPES: ReportMeta[] = [
  {
    type: 'thermal',
    title: '🌡️ Upper-Ocean Thermal Structure (MLD/D26/BLT)',
    description: 'Mixed Layer Depth (MLD), 26°C Isotherm (D26), TCHP, thermocline gradient, and barrier layer thickness.',
    provenance: 'DERIVED from REAL Argo',
  },
  {
    type: 'cyclone_heat',
    title: '🌀 Cyclone Heat Potential (TCHP) & Energy Bands',
    description: 'Upper-ocean heat content above 26°C with real IBTrACS tropical cyclone track overlay and RI energy bands.',
    provenance: 'DERIVED (Argo + IBTrACS)',
  },
  {
    type: 'fishing',
    title: '🐟 Fishing Conditions & Habitat Context (PFZ)',
    description: 'Thermal discontinuity fronts, chlorophyll gradients, and pelagic aggregation depth context.',
    provenance: 'DERIVED from REAL observations',
  },
  {
    type: 'forecast_vs_obs',
    title: '📊 Forecast vs Observation Validation (CMEMS vs Argo)',
    description: 'Depth-strata error statistics (RMSE, bias, Pearson r) comparing external operational models with Argo.',
    provenance: 'SIMULATED (Model vs REAL Argo)',
  },
];

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<string>('thermal');
  const [startDate, setStartDate] = useState<string>('2020-01-01');
  const [endDate, setEndDate] = useState<string>('2020-02-01');
  const [region, setRegion] = useState<string>('Bay of Bengal (5–23°N, 80–100°E)');
  const [stormName, setStormName] = useState<string>('AMPHAN');
  const [loading, setLoading] = useState<boolean>(false);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [headline, setHeadline] = useState<string>('');
  const [provenance, setProvenance] = useState<string>('DERIVED');
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          region,
          start: startDate,
          end: endDate,
          format: 'json',
          storm_name: stormName,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      setReportHtml(data.html || '');
      setHeadline(data.headline || '');
      setProvenance(data.provenance || 'DERIVED');
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handleDownloadHtml = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Oceiana_${reportType}_Report_${startDate}_${endDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <FileText size={24} color="#0284c7" />
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Automated Oceanographic Reports</h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              background: '#0369a1',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}>
              USP Core Engine
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              background: provenance === 'SIMULATED' ? '#854d0e' : '#166534',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
            }}>
              <ShieldCheck size={12} />
              {provenance}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Visual, auto-generated, source-cited scientific intelligence for the Bay of Bengal. Renders 100% offline from verified observation cache.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generating...' : 'Refresh Report'}
          </button>

          <button
            onClick={handleDownloadHtml}
            disabled={!reportHtml}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: !reportHtml ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Download size={14} />
            Export HTML
          </button>

          <button
            onClick={handlePrint}
            disabled={!reportHtml}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#334155',
              border: 'none',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: !reportHtml ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Printer size={14} />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Control Selector Bar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {/* Report Type Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
            REPORT PRODUCT
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {REPORT_TYPES.map((rt) => (
              <option key={rt.type} value={rt.type}>
                {rt.title}
              </option>
            ))}
          </select>
        </div>

        {/* Region */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
            OCEANIC REGION
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <option value="Bay of Bengal (5–23°N, 80–100°E)">Bay of Bengal (5–23°N, 80–100°E)</option>
            <option value="Arabian Sea (5–26°N, 55–77.5°E)">Arabian Sea (5–26°N, 55–77.5°E)</option>
          </select>
        </div>

        {/* Temporal Window */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
            TEMPORAL WINDOW (START / END)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '50%',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '50%',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
          </div>
        </div>

        {/* Cyclone Specific Options */}
        {reportType === 'cyclone_heat' && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
              STORM TRACK OVERLAY (IBTrACS)
            </label>
            <select
              value={stormName}
              onChange={(e) => setStormName(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <option value="AMPHAN">Super Cyclone AMPHAN (2020)</option>
              <option value="FANI">Extremely Severe Cyclone FANI (2019)</option>
              <option value="BOB 01">Deep Depression BOB 01</option>
            </select>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#fca5a5',
          fontSize: '13px',
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Headline Callout */}
      {headline && !error && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          borderLeft: '4px solid #10b981',
          borderRadius: '0 6px 6px 0',
          padding: '12px 16px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>
            Data-Computed Headline Finding
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ecfdf5' }}>
            {headline}
          </div>
        </div>
      )}

      {/* Embedded Sandboxed Report Iframe */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        minHeight: '800px',
        border: '1px solid #cbd5e1',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '600px',
            color: '#64748b',
          }}>
            <RefreshCw size={32} className="animate-spin" color="#0284c7" style={{ marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#334155' }}>Generating Visual Oceanographic Report...</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Computing TEOS-10 thermodynamics, MLD, TCHP, and rendering charts offline</div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={reportHtml}
            title="Generated Scientific Report"
            style={{
              width: '100%',
              height: '950px',
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin allow-modals allow-popups"
          />
        )}
      </div>
    </div>
  );
};
