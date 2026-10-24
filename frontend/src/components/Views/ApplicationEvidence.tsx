import { useEffect, useState } from 'react';
import { Fish, ShieldAlert, Layers, FileText } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
interface ScienceProducts {
  metadata: { n_profiles?: number; start: string; end: string };
  mld?: { mld_median_m?: number };
  thermocline?: { thermocline_depth_median_m?: number };
  tchp?: { tchp_median_kj_cm2?: number; d26_median_m?: number };
}
const format = (n?: number) => n == null || !Number.isFinite(n) ? 'Unavailable' : n.toFixed(1);
export function ApplicationEvidence({ purpose, onReport }: { purpose: 'fishery' | 'hazard'; onReport: (type: string) => void }) {
  const [products, setProducts] = useState<ScienceProducts | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const fishing = purpose === 'fishery';
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/science/products?start=2020-01-01&end=2020-02-01', { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Scientific products are unavailable.');
        return data as ScienceProducts;
      }).then(setProducts).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [retry]);
  const depth = () => { const state = OceanState.getInstance(); state.setUnderwaterRegion('bay-of-bengal'); state.setActivePage('3d-ocean'); state.setMode('underwater'); };
  return <section className="application-evidence" aria-label="Measured evidence and application context">
    <div className="evidence-heading">{fishing ? <Fish size={26} /> : <ShieldAlert size={26} />}<div><span>BAY OF BENGAL / OBSERVATIONS TO APPLICATION</span><h1>{fishing ? 'Where ocean structure meets fisheries' : 'See the ocean conditions behind a hazard'}</h1></div></div>
    <p>{fishing ? 'Use the depth layers and profile graph to explore thermal structure and stratification. Thermocline depth provides habitat context; SST and chlorophyll fronts can help identify candidate fishing areas when matching datasets are available.' : 'Use the 3D water column to explore how deep warm water extends. D26 and heat content describe the ocean’s thermal contribution to cyclone conditions; currents and waves require their own validated inputs.'}</p>
    <div className="evidence-metrics">{(fishing ? [['Median mixed layer', format(products?.mld?.mld_median_m), 'm'], ['Median thermocline', format(products?.thermocline?.thermocline_depth_median_m), 'm']] : [['Median D26', format(products?.tchp?.d26_median_m), 'm'], ['Median heat potential', format(products?.tchp?.tchp_median_kj_cm2), 'kJ/cm²']]).map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{!products && !error ? 'Loading…' : value} {value !== 'Unavailable' && products && <small>{unit}</small>}</strong></div>)}<div><span>Evidence window</span><strong>January 2020</strong><small>{products?.metadata.n_profiles != null ? `${products.metadata.n_profiles} profiles · DERIVED from Argo` : 'Historical Argo observations'}</small></div></div>
    {error && <div className="evidence-error" role="alert">{error} <button onClick={() => { setError(''); setProducts(null); setRetry(n => n + 1); }}>Retry</button></div>}
    <div className="evidence-actions"><button onClick={depth}><Layers size={15} /> Explore depth layers &amp; graph</button><button onClick={() => onReport(fishing ? 'fishing' : 'cyclone_heat')}><FileText size={15} /> Open {fishing ? 'habitat' : 'cyclone heat'} report</button></div>
    <div className="scenario-note"><strong>Demonstration below · SYNTHETIC scenarios.</strong> {fishing ? 'The existing fishing-zone visuals illustrate the workflow; their zones and forecasts are placeholders, not detected fish locations or official PFZ advisories.' : 'The existing hazard map illustrates threshold analysis; its scenario values and actions are placeholders, not measured hazards or operational alerts.'} Measured diagnostics above remain separate from these scenarios.</div>
  </section>;
}
