import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Droplets,
  Play,
  CheckCircle2,
  Store,
  TrendingUp,
  Mic,
  Bell,
  Settings,
  ArrowRight,
  RefreshCw,
  Plus,
  HelpCircle,
  Cpu,
  Layers,
  Database,
  Globe,
} from 'lucide-react';
import {
  executeSimulatedIrrigation,
  fetchIrrigationRecommendation,
  fetchListings,
  fetchListingOffers,
  createListing,
  fetchMarketPrices,
  fetchCommunityOutbreaks,
  fetchLatestSensor,
  type IrrigationRecommendation,
  type Listing,
  type Offer,
  type MarketPriceRef,
  type OutbreakCluster,
} from '../services/api';
import { countPendingOutbox } from '../services/offlineStore';

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

/* ─────────────────────────────────────────────────────────
   1. SMART IRRIGATION PAGE
───────────────────────────────────────────────────────── */
export const IrrigationPage: React.FC = () => {
  const [sectorId, setSectorId] = useState<number>(1);
  const [rec, setRec] = useState<IrrigationRecommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const sectorCrops: Record<number, { name: string; crop: string; area: string }> = {
    1: { name: 'North Parcel A', crop: 'Roma Tomatoes', area: '0.8 ha' },
    2: { name: 'South Parcel B', crop: 'Sweet Corn', area: '0.6 ha' },
    3: { name: 'East Basin C', crop: 'Basmati Rice', area: '0.6 ha' },
    4: { name: 'West Terrace D', crop: 'Cassava', area: '0.5 ha' },
  };

  const loadRecommendation = async (id: number) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetchIrrigationRecommendation(id, 0.1);
      setRec(res);
    } catch (error) {
      setRec(null);
      setStatusMsg(`No current recommendation is available: ${error instanceof Error ? error.message : 'backend unavailable'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendation(sectorId);
  }, [sectorId]);

  const handleRunCycle = async () => {
    setExecuting(true);
    try {
      const res = await executeSimulatedIrrigation(sectorId);
      setStatusMsg(`Simulated irrigation decision recorded for ${res.duration_minutes} min. No hardware was activated.`);
      loadRecommendation(sectorId);
    } catch (err: any) {
      setStatusMsg(`Execution failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="route-page-container">
      {/* Header Banner */}
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <Droplets size={13} />
              <span>Hydrological Automation</span>
            </span>
            <span className="simul-badge-pill">[SIMULATED IRRIGATION LOG]</span>
          </div>
          <h1 className="route-title">Smart Farm Irrigation Control</h1>
          <p className="route-subtitle">
            Dynamic evapotranspiration modeling and soil telemetry rules govern water allocation without physical relay connection.
          </p>
        </div>

        <div className="water-savings-box">
          <span className="savings-label">Water Conserved This Week</span>
          <div className="savings-number">Not calculated</div>
          <span className="savings-sub">No verified weekly total is available.</span>
        </div>
      </div>

      {/* Sector Tab Selector */}
      <div className="irrigation-tabs-bar">
        {Object.entries(sectorCrops).map(([idStr, info]) => {
          const id = Number(idStr);
          return (
            <button
              key={id}
              className={`irrigation-tab-btn ${sectorId === id ? 'tab-active' : ''}`}
              onClick={() => setSectorId(id)}
            >
              <strong>{info.name}</strong>
              <span className="tab-crop-name">{info.crop} ({info.area})</span>
            </button>
          );
        })}
      </div>

      {/* Recommendation Card */}
      <div className="irrigation-body-grid">
        <div className="irrigation-main-card">
          <div className="irrig-card-header">
            <div>
              <span className="crop-badge">{sectorCrops[sectorId]?.crop}</span>
              <h2 className="irrig-sector-title">{sectorCrops[sectorId]?.name}</h2>
            </div>
            <span className="simul-tag">[SIMULATED DECISION ENGINE]</span>
          </div>

          {loading ? (
            <div className="card-loading-state">Evaluating soil telemetry & weather rules...</div>
          ) : rec ? (
            <div className="rec-details-block">
              <div className="decision-banner">
                <span className="decision-label">Recommended Action:</span>
                <span className={`decision-badge badge-${rec.decision}`}>
                  {rec.decision.toUpperCase()} · {rec.duration_minutes} MINUTES
                </span>
              </div>

              <p className="decision-reason-text">{rec.reason_plain}</p>

              <div className="metrics-triad">
                <div className="triad-item">
                  <span className="triad-label">Current Moisture</span>
                  <span className="triad-val">{rec.moisture_at_decision}%</span>
                </div>
                <div className="triad-item">
                  <span className="triad-label">Decision Rule Code</span>
                  <span className="triad-val code-font">{rec.rule_code}</span>
                </div>
                <div className="triad-item">
                  <span className="triad-label">Sensor Freshness</span>
                  <span className="triad-val text-sage">{rec.sensor_stale ? 'Stale' : 'Fresh'}</span>
                </div>
              </div>

              {statusMsg && (
                <div className="feedback-banner">
                  <CheckCircle2 size={16} />
                  <span>{statusMsg}</span>
                </div>
              )}

              <div className="action-buttons-group">
                <button
                  type="button"
                  className="execute-cycle-btn"
                  onClick={handleRunCycle}
                  disabled={executing}
                >
                  <Play size={16} />
                  <span>{executing ? 'Recording Decision...' : `Record Simulated Decision (${rec.duration_minutes} Min)`}</span>
                </button>
                <button
                  type="button"
                  className="refresh-rec-btn"
                  onClick={() => loadRecommendation(sectorId)}
                >
                  <RefreshCw size={15} />
                  <span>Re-evaluate Rules</span>
                </button>
              </div>

              <div className="safety-disclaimer">
                <span>⚠️ Note: All irrigation commands are deterministic software simulations with logged audit trails. No physical valves or relays are actuated.</span>
              </div>
            </div>
          ) : !loading ? <p className="p-6 text-sm text-charcoal-600">{statusMsg || 'No recommendation is available for this parcel.'}</p> : null}
        </div>

        {/* Side Rules & Schedule Card */}
        <div className="irrigation-side-card">
          <h3 className="side-card-title">Irrigation Decision Logic</h3>
          <ul className="decision-rules-list">
            <li>
              <strong>1. Root-Zone Moisture Guard:</strong> Water automatically if root-zone moisture drops below crop minimum (Tomatoes: 30%, Cassava: 25%).
            </li>
            <li>
              <strong>2. Rain Forecast Inhibit:</strong> If rainfall probability &gt; 60% within 12 hours, postpone irrigation to prevent waterlogging.
            </li>
            <li>
              <strong>3. High-Evaporation Buffer:</strong> Avoid high-heat midday intervals (12:00 PM – 3:00 PM) to minimize evaporative loss.
            </li>
          </ul>

          <div className="weather-forecast-tile">
            <span className="tile-title">24h Rainfall Forecast</span>
            <div className="tile-rain-stat">[SIMULATED INPUT] 10% rain chance</div>
            <p className="tile-desc">A fixed demo value is passed to the irrigation rule endpoint; it is not a live forecast.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   2. MARKETPLACE PAGE
───────────────────────────────────────────────────────── */
export const MarketplacePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'listings' | 'bids'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newCrop, setNewCrop] = useState<string>('Tomato (Roma Grade A)');
  const [newQty, setNewQty] = useState<number>(600);
  const [newPrice, setNewPrice] = useState<number>(27.0);
  const [newDistrict, setNewDistrict] = useState<string>('Pune');
  const [posting, setPosting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await fetchListings();
      setListings(data);
      const groups = await Promise.all(data.map((listing) => fetchListingOffers(listing.id).catch((): Offer[] => [])));
      setOffers(groups.flat());
      setStatusMsg(null);
    } catch {
      setListings([]);
      setOffers([]);
      setStatusMsg('Marketplace service unavailable. No listings or buyer offers are shown until the backend reconnects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setStatusMsg(null);
    try {
      await createListing({
        farmer_id: 1,
        crop: newCrop,
        quantity_kg: Number(newQty),
        asking_price_per_kg: Number(newPrice),
        unit: 'kg',
        district: newDistrict,
        description: 'Harvested lot, verified quality direct farmgate.',
      });
      setShowModal(false);
      setStatusMsg('New produce listing published successfully.');
      await loadListings();
    } catch (err: any) {
      setStatusMsg(`Failed to publish listing: ${err.message}`);
    } finally {
      setPosting(false);
    }
  };


  return (
    <div className="route-page-container">
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <Store size={13} />
              <span>Direct Farmgate Trade</span>
            </span>
            <span className="simul-badge-pill">[DIRECT FARMER-TO-BUYER]</span>
          </div>
          <h1 className="route-title">Direct Produce Marketplace</h1>
          <p className="route-subtitle">
            Listings and buyer offers are read from the AgriEdge API. A publish confirmation appears only after the backend accepts the listing.
          </p>
        </div>

        <button className="create-listing-btn" onClick={() => setShowModal(!showModal)}>
          <Plus size={16} />
          <span>{showModal ? 'Close Form' : 'Post Produce Listing'}</span>
        </button>
      </div>

      {statusMsg && (
        <div className="p-3 mb-4 rounded-lg bg-sand-100 border border-olive-200 text-charcoal-700 text-sm">
          {statusMsg}
        </div>
      )}

      {/* New Listing Modal / Form */}
      {showModal && (
        <form onSubmit={handleCreateListing} className="p-5 mb-6 rounded-xl bg-white border border-olive-200 shadow-sm flex flex-col gap-4">
          <h3 className="text-base font-semibold text-charcoal-900">Post New Produce Listing</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-charcoal-600 block mb-1">Crop & Variety</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-olive-200 rounded-lg text-sm bg-sand-50"
                value={newCrop}
                onChange={(e) => setNewCrop(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-charcoal-600 block mb-1">Quantity (kg)</label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-olive-200 rounded-lg text-sm bg-sand-50"
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-charcoal-600 block mb-1">Asking Price (₹ / kg)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                className="w-full px-3 py-2 border border-olive-200 rounded-lg text-sm bg-sand-50"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-charcoal-600 block mb-1">Mandi / District</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-olive-200 rounded-lg text-sm bg-sand-50"
                value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-charcoal-600 rounded-lg hover:bg-sand-100"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting}
              className="px-5 py-2 text-sm bg-olive-700 text-white rounded-lg font-medium hover:bg-olive-800 disabled:opacity-50"
            >
              {posting ? 'Publishing...' : 'Publish Listing'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="marketplace-tabs-bar">
        <button
          className={`market-tab-btn ${activeTab === 'listings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          My Active Produce Listings ({listings.length})
        </button>
        <button
          className={`market-tab-btn ${activeTab === 'bids' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('bids')}
        >
          Received Buyer Offers ({offers.length})
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="p-8 text-center text-charcoal-600 font-medium">Loading active produce listings...</div>
      ) : activeTab === 'listings' ? (
        <div className="listings-grid">
          {listings.map((l) => (
            <div key={l.id} className="listing-card">
              <div className="listing-card-header">
                <span className="listing-crop-tag">{l.crop}</span>
                <span className="listing-status-badge">{l.status}</span>
              </div>
              <div className="listing-price-row">
                <span className="listing-price">₹{Number(l.asking_price_per_kg).toFixed(2)} / kg</span>
                <span className="listing-qty">Qty: {l.quantity_kg.toLocaleString()} {l.unit || 'kg'}</span>
              </div>
              <div className="listing-meta-info">
                <div>📍 {l.district}</div>
                <div>🗓 Listed: {new Date(l.created_at).toLocaleDateString()}</div>
              </div>
              <div className="listing-card-footer">
                <span className="bids-count-chip">Backend listing</span>
                <button className="view-bids-btn" onClick={() => setActiveTab('bids')}>
                  <span>View Offers</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="p-6 text-sm text-charcoal-600">No active listings are available from the backend.</p>}
        </div>
      ) : (
        <div className="bids-list">
          {offers.map((b) => (
            <div key={b.id} className="bid-card">
              <div className="bid-header">
                <div>
                  <h3 className="buyer-name">Buyer account #{b.buyer_farmer_id}</h3>
                  <span className="bid-crop">{listings.find((listing) => listing.id === b.listing_id)?.crop ?? `Listing #${b.listing_id}`}</span>
                </div>
                <div className="bid-price-box">
                  <span className="offered-price">₹{Number(b.offered_price_per_kg).toFixed(2)} / kg</span>
                  <span className="qty-tag">{Number(b.quantity_kg).toLocaleString()} kg · {b.status}</span>
                </div>
              </div>
              <div className="bid-terms-row"><span>{b.message || 'No buyer note supplied.'}</span><span>{new Date(b.created_at).toLocaleString()}</span></div>
            </div>
          ))}
          {offers.length === 0 && <p className="p-6 text-sm text-charcoal-600">No buyer offers are recorded for the available listings.</p>}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   3. MARKET PRICES BENCHMARK PAGE
───────────────────────────────────────────────────────── */
export const MarketPricesPage: React.FC = () => {
  const [marketPrices, setMarketPrices] = useState<MarketPriceRef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrices = async () => {
      setLoading(true);
      try {
        const data = await fetchMarketPrices();
        setMarketPrices(data);
        setLoadError(null);
      } catch {
        setMarketPrices([]);
        setLoadError('Reference prices are unavailable while the backend is offline.');
      } finally {
        setLoading(false);
      }
    };
    loadPrices();
  }, []);

  return (
    <div className="route-page-container">
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <TrendingUp size={13} />
              <span>Regional Price Intelligence</span>
            </span>
            <span className="simul-badge-pill">[SIMULATED BENCHMARK ONLY]</span>
          </div>
          <h1 className="route-title">Mandi Reference Prices</h1>
          <p className="route-subtitle">
            Crop-level reference ranges returned by the AgriEdge API. These records are not separated by mandi unless their source data says so.
          </p>
        </div>
      </div>

      {/* Honest Provenance Alert */}
      <div className="mandi-notice-box">
        <HelpCircle size={18} className="text-olive" />
        <span>
          <strong>Honesty Notice:</strong> The prices below are database references marked simulated or non-live by their source. They are <strong>NOT</strong> live feeds from AGMARKNET or government price APIs.
        </span>
      </div>

      {/* Price Table */}
      <div className="mandi-price-table-card">
        <div className="table-header-title">
          <h3>Recorded Crop Reference Ranges (Per Kilogram)</h3>
          <span className="simul-tag">[NON-LIVE REFERENCE DATA]</span>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="p-8 text-center text-charcoal-600 font-medium">Loading benchmark price telemetry...</div>
          ) : (
            <table className="mandi-table">
              <thead>
                <tr>
                  <th>Crop Variety</th>
                  <th>Minimum Rate</th>
                  <th>Modal (Average)</th>
                  <th>Maximum Rate</th>
                  <th>Source Note</th>
                  <th>Reference Date</th>
                </tr>
              </thead>
            <tbody>
              {marketPrices.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.crop}</strong></td>
                  <td>₹{row.min_price_per_kg.toFixed(2)}</td>
                  <td className="col-modal-price">₹{row.avg_price_per_kg.toFixed(2)}</td>
                  <td>₹{row.max_price_per_kg.toFixed(2)}</td>
                  <td>{row.source_note}{row.is_simulated ? ' [SIMULATED]' : ''}</td>
                  <td>{row.reference_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {!loading && loadError && <p className="p-6 text-sm text-charcoal-600">{loadError}</p>}
          {!loading && !loadError && marketPrices.length === 0 && <p className="p-6 text-sm text-charcoal-600">No price reference records are available.</p>}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   4. VOICE ASSISTANT PAGE
───────────────────────────────────────────────────────── */
export const VoiceAssistantPage: React.FC = () => {
  const [listening, setListening] = useState<boolean>(false);
  const [language, setLanguage] = useState<'HI' | 'EN'>('HI');
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('Ask about stored irrigation decisions, reference prices, or farmer report clusters.');

  const [textQuery, setTextQuery] = useState<string>('');

  const samplePrompts = [
    { hi: 'आज पाणी द्यावे लागेल का?', en: 'Do any crops need watering today?' },
    { hi: 'पुणे बाजारात टोमॅटोचा भाव काय आहे?', en: "What is today's tomato rate in Pune?" },
    { hi: 'कसावा पिकाची आर्द्रता दाखवा', en: 'Show Cassava parcel soil moisture' },
    { hi: 'रोग प्रतिबंधात्मक इशारे सांगा', en: 'Are there any nearby disease outbreaks?' },
  ];

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const answerQuery = async (query: string) => {
    const normalized = query.toLowerCase();
    setResponse('Checking the available AgriEdge records…');
    try {
      if (/outbreak|disease|\u0930\u094b\u0917|\u0915\u0940\u091f/.test(normalized)) {
        const clusters = await fetchCommunityOutbreaks();
        setResponse(clusters.length
          ? clusters.map((item) => `${item.crop}, ${item.disease_label}, ${item.district}: ${item.report_count} farmer reports [UNVERIFIED REPORT CLUSTER]`).join('; ')
          : 'No farmer report clusters are recorded by the backend. This does not confirm that no disease is present.');
      } else if (/price|rate|mandi|market|tomato|\u092d\u093e\u0935|\u092c\u093e\u091c\u093e\u0930/.test(normalized)) {
        const crop = /tomato|\u091f\u092e\u093e\u091f\u0930/.test(normalized) ? 'Tomato' : undefined;
        const prices = await fetchMarketPrices(crop);
        setResponse(prices.length
          ? prices.map((item) => `${item.crop}: INR ${item.min_price_per_kg}-${item.max_price_per_kg}/kg, reference ${item.reference_date}, ${item.is_simulated ? '[SIMULATED]' : '[NON-LIVE REFERENCE]'} (${item.source_note})`).join('; ')
          : 'No matching crop price references are stored. No live AGMARKNET feed is connected.');
      } else if (/water|irrigat|moisture|\u092a\u093e\u0928\u0940|\u0938\u093f\u0902\u091a|\u0928\u092e\u0940/.test(normalized)) {
        const [reading, decision] = await Promise.all([
          fetchLatestSensor(1),
          fetchIrrigationRecommendation(1, 0.1),
        ]);
        setResponse(`Parcel 1 soil moisture: ${reading.moisture_pct}%${reading.is_simulated ? ' [SIMULATED]' : ''}. Rule result: ${decision.decision} for ${decision.duration_minutes} minutes. ${decision.reason_plain} The 10% rain chance is a fixed simulated input; no hardware is controlled.`);
      } else {
        setResponse('I can look up stored soil moisture and irrigation rules, crop price references, or farmer report clusters. Try one of those topics.');
      }
    } catch (error) {
      setResponse(`The requested backend information is unavailable: ${error instanceof Error ? error.message : 'connection error'}. I have not substituted sample readings or prices.`);
    }
  };

  const handlePromptClick = (prompt: { hi: string; en: string }) => {
    setTranscript(language === 'HI' ? prompt.hi : prompt.en);
    void answerQuery(prompt.en);
  };

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = textQuery.trim();
    if (!query) return;
    setTranscript(query);
    void answerQuery(query);
    setTextQuery('');
  };

  const toggleListen = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setResponse('Browser speech recognition is unavailable here. Use the text query field instead.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = language === 'HI' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spokenQuery = event.results[0]?.[0]?.transcript?.trim();
      if (spokenQuery) {
        setTranscript(spokenQuery);
        void answerQuery(spokenQuery);
      }
    };
    recognition.onerror = () => setResponse('Speech recognition failed. Check microphone permission or use the text query field.');
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch (error) {
      setListening(false);
      setResponse(`Could not start browser speech recognition: ${error instanceof Error ? error.message : 'unknown error'}.`);
    }
  };

  return (
    <div className="route-page-container">
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <Mic size={13} />
              <span>Voice Interface</span>
            </span>
            <span className="simul-badge-pill">[BROWSER SPEECH INPUT · BACKEND LOOKUPS]</span>
          </div>
          <h1 className="route-title">AgriEdge Multilingual Voice Assistant</h1>
          <p className="route-subtitle">
            Browser speech recognition uses the selected language when supported. Replies look up stored farm records and are currently displayed in English; no speech synthesis is connected.
          </p>
        </div>

        <div className="voice-lang-toggle">
          <button
            className={`lang-btn ${language === 'HI' ? 'active' : ''}`}
            onClick={() => setLanguage('HI')}
          >
            हिंदी / मराठी
          </button>
          <button
            className={`lang-btn ${language === 'EN' ? 'active' : ''}`}
            onClick={() => setLanguage('EN')}
          >
            English
          </button>
        </div>
      </div>

      {/* Voice Assistant Centerpiece */}
      <div className="voice-centerpiece-card">
        <div className="mic-button-wrapper">
          {listening && (
            <div className="mic-rings-animation" aria-hidden="true">
              <div className="mic-ring-1" />
              <div className="mic-ring-2" />
            </div>
          )}
          <button
            type="button"
            className={`big-mic-btn ${listening ? 'mic-listening' : ''}`}
            onClick={toggleListen}
            aria-label="Toggle voice input"
          >
            <Mic size={36} className={listening ? 'mic-pulsing' : ''} />
          </button>
          <span className="mic-hint-text">
            {listening
              ? language === 'HI' ? 'ऐकत आहे... बोला' : 'Listening… speak now'
              : language === 'HI' ? 'बोलण्यासाठी मायक्रोफोन टॅप करा' : 'Tap microphone to speak'}
          </span>
        </div>

        {/* Text Input Fallback */}
        <form className="voice-text-fallback-form" onSubmit={handleTextSubmit}>
          <input
            type="text"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder={
              language === 'HI'
                ? 'किंवा येथे प्रश्न टाईप करा… (उदा. टोमॅटो भाव, पाणी देणे)'
                : 'Or type your question here… (e.g. check tomato rates, soil moisture)'
            }
            className="fallback-query-input"
            aria-label="Text query input fallback"
          />
          <button type="submit" className="fallback-submit-btn" aria-label="Send query">
            <span>Ask</span>
          </button>
        </form>

        {/* Query & Spoken Response Card */}
        <div className="dialog-display-box">
          <div className="user-query-bubble">
            <span className="bubble-label">Farmer Query:</span>
            <p className="bubble-text">“{transcript}”</p>
          </div>

          <div className="agent-response-bubble">
            <span className="bubble-label">AgriEdge OS Response:</span>
            <p className="bubble-text">{response}</p>
          </div>
        </div>

        {/* Quick Sample Prompts */}
        <div className="sample-prompts-section">
          <span className="sample-title">Quick Voice Commands:</span>
          <div className="sample-chips-row">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                className="sample-prompt-chip"
                onClick={() => handlePromptClick(p)}
              >
                {language === 'HI' ? p.hi : p.en}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   5. ALERTS & OUTBREAK RADAR PAGE
───────────────────────────────────────────────────────── */
export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<OutbreakCluster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunityOutbreaks()
      .then(setAlerts)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Community report data unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="route-page-container">
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <Bell size={13} />
              <span>Community Biosecurity</span>
            </span>
            <span className="simul-badge-pill">[FARMER REPORT CLUSTERS · NOT FIELD VERIFIED]</span>
          </div>
          <h1 className="route-title">Regional Outbreak Radar & Alerts</h1>
          <p className="route-subtitle">
            Clusters are generated from farmer-submitted reports. They are not verified diagnoses or official disease alerts.
          </p>
        </div>

        <Link to="/agrisnap" className="report-outbreak-cta">
          <span>Scan Leaf with AgriSnap</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="alerts-list">
        {loading && <p className="p-6 text-sm text-charcoal-600">Loading community report clusters…</p>}
        {loadError && <p className="p-6 text-sm text-charcoal-600">Report clusters are unavailable: {loadError}</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`alert-card severity-${a.severity_level}`}>
            <div className="alert-card-top">
              <div className="alert-badge-wrap">
                <span className={`alert-severity-badge badge-${a.severity_level}`}>
                  {a.severity_level.toUpperCase()} REPORT CLUSTER
                </span>
                <span className="alert-crop-pill">{a.crop} · {a.disease_label}</span>
                <span className="alert-distance">{a.district}</span>
              </div>
              <span className="alert-time">{a.report_count} reports · {a.window_start} to {a.window_end}</span>
            </div>

            <h3 className="alert-headline">{a.disease_label} reports for {a.crop}</h3>
            <p className="alert-details-text">The community API grouped {a.report_count} farmer-submitted reports. Report counts do not confirm disease presence.</p>

            <div className="alert-recommended-box">
              <strong>Suggested follow-up:</strong>
              <p>Inspect affected plants and ask a local agricultural extension specialist to confirm before applying any treatment.</p>
            </div>
          </div>
        ))}
        {!loading && !loadError && alerts.length === 0 && <p className="p-6 text-sm text-charcoal-600">No farmer report clusters are currently recorded in the backend.</p>}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   6. SETTINGS & LANGUAGE PAGE
───────────────────────────────────────────────────────── */
export const SettingsPage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [syncRate, setSyncRate] = useState<number>(30);
  const [pendingSyncs, setPendingSyncs] = useState<number | null>(null);
  const [offlineReady, setOfflineReady] = useState<boolean>(false);

  useEffect(() => {
    const refreshPending = () => countPendingOutbox().then(setPendingSyncs).catch(() => setPendingSyncs(null));
    refreshPending();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => setOfflineReady(false));
      navigator.serviceWorker.addEventListener('controllerchange', () => setOfflineReady(true));
    }
    window.addEventListener('online', refreshPending);
    navigator.serviceWorker?.addEventListener('message', refreshPending);
    return () => {
      window.removeEventListener('online', refreshPending);
      navigator.serviceWorker?.removeEventListener('message', refreshPending);
    };
  }, []);

  return (
    <div className="route-page-container">
      <div className="route-header-card">
        <div className="route-header-left">
          <div className="route-pill-row">
            <span className="route-chip-sage">
              <Settings size={13} />
              <span>System Preferences</span>
            </span>
            <span className="simul-badge-pill">[AGRIEDGE OS V2.1]</span>
          </div>
          <h1 className="route-title">OS Settings & System Configuration</h1>
          <p className="route-subtitle">
            Configure telemetry polling cadence, multilingual preferences, offline storage caching, and inspect software provenance.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Localization */}
        <div className="setting-card">
          <div className="setting-card-header">
            <Globe size={18} className="text-sage" />
            <h3>Language & Interface Localization</h3>
          </div>
          <p className="setting-desc">Select your preferred language for dashboard metrics, farmer guidance, and voice responses.</p>
          <div className="setting-control-row">
            <button
              className={`setting-choice-btn ${lang === 'en' ? 'choice-selected' : ''}`}
              onClick={() => setLang('en')}
            >
              English (Indian Standard)
            </button>
            <button
              className={`setting-choice-btn ${lang === 'hi' ? 'choice-selected' : ''}`}
              onClick={() => setLang('hi')}
            >
              हिंदी / मराठी (Hindi / Marathi)
            </button>
          </div>
        </div>

        {/* Telemetry Polling */}
        <div className="setting-card">
          <div className="setting-card-header">
            <Cpu size={18} className="text-olive" />
            <h3>Telemetry Refresh Rate</h3>
          </div>
          <p className="setting-desc">Frequency of simulated sensor reading syncs between FastAPI backend and browser.</p>
          <div className="setting-control-row">
            {[15, 30, 60].map((rate) => (
              <button
                key={rate}
                className={`setting-choice-btn ${syncRate === rate ? 'choice-selected' : ''}`}
                onClick={() => setSyncRate(rate)}
              >
                Every {rate} Seconds
              </button>
            ))}
          </div>
        </div>

        {/* Offline Cache Status */}
        <div className="setting-card">
          <div className="setting-card-header">
            <Database size={18} className="text-sage" />
            <h3>Offline Cache & Storage</h3>
          </div>
          <p className="setting-desc">The service worker caches the app and local model. IndexedDB stores AgriSnap scan metadata only; farm telemetry is not cached for offline use.</p>
          <div className="offline-status-row">
            <div className="cache-pill">
              {offlineReady && pendingSyncs !== null ? <CheckCircle2 size={14} className="text-sage" /> : <Database size={14} />}
              <span>{offlineReady ? 'Service Worker Ready' : 'Service Worker Not Confirmed'} · {pendingSyncs === null ? 'IndexedDB Unavailable' : `IndexedDB Active · ${pendingSyncs} Pending Scan Syncs`}</span>
            </div>
            <button
              className="clear-cache-btn"
              onClick={() => navigator.serviceWorker?.controller?.postMessage({ type: 'SYNC_OUTBOX' })}
            >
              Sync Pending Data
            </button>
          </div>
        </div>

        {/* Provenance and Integrity */}
        <div className="setting-card full-width">
          <div className="setting-card-header">
            <Layers size={18} className="text-brown" />
            <h3>Project Architecture & Provenance Verification</h3>
          </div>
          <div className="provenance-details-grid">
            <div className="prov-item">
              <strong>Neural Model:</strong>
              <span>Local MobileNetV2 TFLite artifact with 10 PlantVillage tomato labels; model provenance and field accuracy are not independently verified.</span>
            </div>
            <div className="prov-item">
              <strong>Backend Runtime:</strong>
              <span>FastAPI (Python 3.12) + SQLite Async Engine</span>
            </div>
            <div className="prov-item">
              <strong>Frontend Framework:</strong>
              <span>React 19 + TypeScript + Vite</span>
            </div>
            <div className="prov-item">
              <strong>Simulated Data Rule:</strong>
              <span>All telemetry and prices explicitly tagged <code>[SIMULATED]</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
