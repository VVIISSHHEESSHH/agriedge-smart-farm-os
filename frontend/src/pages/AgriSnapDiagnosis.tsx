import React, { useState, useEffect, useRef } from 'react';
import {
  agriSnapService,
  logAgriSnapScan,
  type ModelMetadata,
  type PredictionResult,
} from '../services/api';
import { getStoredScans } from '../services/offlineStore';
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Info,
  ShieldCheck,
  FileCode,
  RotateCcw,
  ChevronDown,
  Cpu,
} from 'lucide-react';

export const AgriSnapDiagnosis: React.FC = () => {
  const [modelState, setModelState] = useState<{
    available: boolean;
    error: string | null;
    meta: ModelMetadata | null;
    loading: boolean;
  }>({
    available: false,
    error: null,
    meta: null,
    loading: true,
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [scanLogged, setScanLogged] = useState<boolean>(false);
  const [scanSyncPending, setScanSyncPending] = useState<boolean>(false);
  const [scanLocalId, setScanLocalId] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize TFJS / TFLite Service on mount
  useEffect(() => {
    const init = async () => {
      const res = await agriSnapService.initialize();
      setModelState({
        available: res.available,
        error: res.error,
        meta: res.meta,
        loading: false,
      });
    };
    init();
  }, []);

  useEffect(() => {
    if (!scanLocalId || !('serviceWorker' in navigator)) return;
    const refreshSyncStatus = () => {
      getStoredScans()
        .then((scans) => {
          const currentScan = scans.find((scan) => scan.localId === scanLocalId);
          if (currentScan) setScanSyncPending(currentScan.syncStatus === 'pending');
        })
        .catch(() => undefined);
    };
    navigator.serviceWorker.addEventListener('message', refreshSyncStatus);
    window.addEventListener('online', refreshSyncStatus);
    refreshSyncStatus();
    return () => {
      navigator.serviceWorker.removeEventListener('message', refreshSyncStatus);
      window.removeEventListener('online', refreshSyncStatus);
    };
  }, [scanLocalId]);

  // Handle local image file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
          setPrediction(null);
          setInferenceError(null);
          setScanLogged(false);
          setScanSyncPending(false);
          setScanLocalId(null);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Camera integration
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setInferenceError(`Could not access camera: ${err.message}. Please use the Upload option instead.`);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureCameraFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelectedImage(dataUrl);
        setPrediction(null);
        setInferenceError(null);
        setScanLogged(false);
        setScanSyncPending(false);
        setScanLocalId(null);
        stopCamera();
      }
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPrediction(null);
    setInferenceError(null);
    setScanLogged(false);
    setScanSyncPending(false);
    setScanLocalId(null);
    stopCamera();
  };

  // Run Real In-Browser Inference
  const handleRunInference = async () => {
    console.log('[AgriSnap] handleRunInference called. Ref:', imageElementRef.current);
    if (!imageElementRef.current) {
      console.warn('[AgriSnap] imageElementRef.current is null!');
      return;
    }
    setAnalyzing(true);
    setInferenceError(null);
    try {
      console.log('[AgriSnap] Calling agriSnapService.predict...');
      const result = await agriSnapService.predict(imageElementRef.current);
      console.log('[AgriSnap] Prediction result:', result);
      setPrediction(result);

      // Log metadata to backend (POST /agrisnap/log) without raw image bytes
      try {
        const savedScan = await logAgriSnapScan({
          farmer_id: 1,
          model_version: result.modelVersion,
          crop_input: 'Tomato',
          predicted_label: result.topMatch.display_name_en,
          confidence: result.confidence / 100.0,
          was_unclear: result.isUncertain,
        });
        setScanLogged(true);
        setScanSyncPending(savedScan.sync_status === 'pending');
        setScanLocalId(savedScan.local_id ?? null);
      } catch (err) {
        console.warn('Failed to log scan metadata to backend:', err);
      }
    } catch (err: any) {
      setInferenceError(err.message || 'Inference failed unexpectedly.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="agrisnap-earthy-page">
      {/* Header Banner */}
      <section className="agrisnap-header-card">
        <div className="agrisnap-header-left">
          <div className="agrisnap-tag-row">
            <span className="agrisnap-chip-sage">
              <Cpu size={13} />
              <span>Edge Neural Network</span>
            </span>
            <span className="privacy-pill">
              <ShieldCheck size={13} />
              <span>100% Client-Side · Zero Image Uploads</span>
            </span>
          </div>
          <h1 className="agrisnap-main-title">AgriSnap AI — Tomato Leaf Health Diagnosis</h1>
          <p className="agrisnap-subtitle">
            Instant leaf pathology screening powered by an onboard MobileNetV2 neural network. Evaluates 10 PlantVillage tomato classes directly in your browser.
          </p>
        </div>

        <div className="agrisnap-header-right">
          <div className="model-provenance-box">
            <div className="prov-row">
              <span className="prov-label">Model Runtime:</span>
              <span className="prov-value">TFLite WASM Engine</span>
            </div>
            <div className="prov-row">
              <span className="prov-label">Input Shape:</span>
              <span className="prov-value">224 × 224 RGB [0, 1]</span>
            </div>
            <div className="prov-row">
              <span className="prov-label">Class Mapping:</span>
              <span className="prov-value">10 metadata-defined tomato classes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Model Status Bar */}
      <section className="model-status-strip">
        <div className="status-indicator-left">
          <span className={`status-dot-pulse ${modelState.available ? 'dot-ready' : 'dot-waiting'}`} />
          <div>
            <strong className="status-title-text">
              {modelState.loading
                ? 'Loading model weights into WebAssembly memory...'
                : modelState.available
                ? `Model loaded in browser (${agriSnapService.getActiveEngine()?.toUpperCase() ?? 'unknown engine'})`
                : 'On-device inference is unavailable'}
            </strong>
            <div className="status-sub-text">
              {modelState.available
                ? 'Weights and runtime loaded. Prediction scores are model outputs, not verified field accuracy.'
                : modelState.error || 'The local model and runtime could not be loaded; no prediction will be generated.'}
            </div>
          </div>
        </div>

        <span className="honest-audit-badge">
          {modelState.available ? `[LOCAL ${agriSnapService.getActiveEngine()?.toUpperCase() ?? 'MODEL'}]` : '[INFERENCE UNAVAILABLE]'}
        </span>
      </section>

      {!modelState.available && !modelState.loading && (
        <section className="model-missing-guidance">
          <Info size={20} className="missing-icon" />
          <div className="missing-content">
            <h4>No synthetic or fake predictions are permitted.</h4>
            <p>
              In accordance with project integrity guidelines, real MobileNetV2 weights (<code>model.tflite</code>) must be installed in <code>frontend/public/models/plant-disease/</code>.
            </p>
            <div className="notebook-links-row">
              <span>Google Colab Pipeline: <code>ml/train_tomato_disease_colab.ipynb</code></span>
              <span>·</span>
              <span>Pipeline Docs: <code>ml/train_tomato_disease_colab.md</code></span>
            </div>
          </div>
        </section>
      )}

      {/* Input Selection: Camera or File Upload */}
      <section className="leaf-capture-section">
        <div className="capture-actions-bar">
          <button
            type="button"
            className="capture-primary-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={17} />
            <span>Select Leaf Photo from Device</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {!cameraActive ? (
            <button
              type="button"
              className="capture-secondary-btn"
              onClick={startCamera}
            >
              <Camera size={17} />
              <span>Use Live Camera</span>
            </button>
          ) : (
            <button
              type="button"
              className="capture-danger-btn"
              onClick={stopCamera}
            >
              <span>Stop Camera</span>
            </button>
          )}

          {selectedImage && (
            <button
              type="button"
              className="capture-reset-btn"
              onClick={handleReset}
              title="Reset current leaf photo"
            >
              <RotateCcw size={16} />
              <span>Clear Sample</span>
            </button>
          )}
        </div>

        {/* Live Camera Viewport */}
        {cameraActive && (
          <div className="live-camera-viewport">
            <video ref={videoRef} autoPlay playsInline className="camera-feed-video" />
            <button
              type="button"
              className="camera-shutter-action-btn"
              onClick={captureCameraFrame}
            >
              📸 Capture Leaf Image
            </button>
          </div>
        )}

        {/* Selected Image Preview & In-Memory Inference CTA */}
        {selectedImage && (
          <div className="specimen-preview-card">
            <div className="specimen-header-row">
              <div className="specimen-title-group">
                <span className="specimen-tag">Active Specimen</span>
                <span className="specimen-name">Tomato Foliage Sample</span>
              </div>

              {modelState.available ? (
                <button
                  type="button"
                  className="run-diagnosis-cta"
                  onClick={handleRunInference}
                  disabled={analyzing}
                >
                  <Sparkles size={16} />
                  <span>{analyzing ? 'Evaluating Neural Weights...' : 'Run Neural Diagnosis'}</span>
                </button>
              ) : (
                <div className="model-disabled-badge">
                  <AlertTriangle size={15} />
                  <span>Inference Disabled — Model Weights Required</span>
                </div>
              )}
            </div>

            <div className="specimen-image-container">
              {analyzing && (
                <div className="leaf-scanner-beam-wrapper" aria-hidden="true">
                  <div className="cellular-mesh-overlay" />
                  <div className="leaf-scanner-beam" />
                  <div className="scanner-target-reticle">
                    <div className="reticle-corner corner-tl" />
                    <div className="reticle-corner corner-tr" />
                    <div className="reticle-corner corner-bl" />
                    <div className="reticle-corner corner-br" />
                    <div className="reticle-pulse-center" />
                  </div>
                  <div className="scanner-status-overlay">
                    <span className="scanner-status-icon">🧬</span>
                    <span>Scanning Cellular Morphology · Evaluating MobileNetV2 Weights…</span>
                  </div>
                </div>
              )}
              <img
                ref={imageElementRef}
                src={selectedImage}
                alt="Selected tomato leaf specimen"
                className={`specimen-img ${analyzing ? 'specimen-analyzing' : ''}`}
              />
            </div>

            {inferenceError && (
              <div className="inference-error-box">
                <AlertTriangle size={18} className="text-terracotta" />
                <span>{inferenceError}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Real In-Browser Prediction Result */}
      {prediction && (
        <section className="prediction-result-panel">
          <div className="prediction-header-block">
            <div className="prediction-left">
              <div className="result-engine-chip">
                <Cpu size={13} />
                <span>{prediction.engine === 'tflite' ? '⚡ TFLite (WASM Runtime)' : '🧠 TensorFlow.js'}</span>
                <span className="engine-sep">·</span>
                <span>Latency: {prediction.inferenceDurationMs}ms</span>
              </div>
              <h2 className="predicted-disease-name">
                {prediction.topMatch.display_name_en}
              </h2>
              <div className="predicted-hindi-title">
                {prediction.topMatch.display_name_hi}
              </div>
            </div>

            <div className="prediction-confidence-card">
              <div className="confidence-num">{prediction.confidence}%</div>
              <div className="confidence-caption">Model Score · Not Field Accuracy</div>
            </div>
          </div>

          {/* Uncertainty Notice */}
          {prediction.isUncertain && (
            <div className="uncertain-warning-banner">
              <AlertTriangle size={20} className="warning-icon" />
              <div>
                <strong>Inconclusive / Low Model Score</strong>
                <p>
                  The score is below the model metadata threshold. The image may have glare, blur, or mixed symptoms. Treat this as screening information and confirm symptoms before taking action.
                </p>
              </div>
            </div>
          )}

          {/* Collapsible 10-Class Probability Breakdown */}
          <details className="tech-probabilities-details">
            <summary className="probabilities-summary-header">
              <div className="summary-left">
                <FileCode size={16} />
                <span>Full 10-Class Neural Probability Breakdown</span>
              </div>
              <ChevronDown size={16} className="chevron-icon" />
            </summary>

            <div className="probabilities-list-wrap">
              <div className="probabilities-list">
                {prediction.allProbabilities.map((item, idx) => (
                  <div key={idx} className="prob-item-row">
                    <span className={`prob-class-name ${idx === 0 ? 'top-class' : ''}`}>
                      {item.className}
                    </span>
                    <div className="prob-bar-track">
                      <div
                        className={`prob-bar-fill ${idx === 0 ? 'fill-top' : 'fill-rest'}`}
                        style={{ width: `${Math.min(100, Math.max(2, item.probability))}%` }}
                      />
                    </div>
                    <span className={`prob-value-text ${idx === 0 ? 'val-top' : ''}`}>
                      {item.probability.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* Farmer Agronomic Guidance */}
          <div className="farmer-guidance-card">
            <h3 className="guidance-heading">Recommended Farmer Actions</h3>
            <div className="guidance-body-en">
              <p>{prediction.topMatch.guidance_en}</p>
            </div>
            <div className="guidance-body-hi">
              <span className="lang-tag">हिंदी मार्गदर्शन:</span>
              <p>{prediction.topMatch.guidance_hi}</p>
            </div>
          </div>

          {/* Action Row & Medical Disclaimer */}
          <div className="result-footer-block">
            <div className="disclaimer-note">
              <HelpCircle size={15} />
              <span>
                <strong>Notice:</strong> This automated screening is an educational advisory tool. Always consult your local Krishi Vigyan Kendra (KVK) or agricultural extension specialist before applying regulated agrochemicals.
              </span>
            </div>

            <div className="footer-button-row">
              <button
                type="button"
                className="scan-another-cta"
                onClick={handleReset}
              >
                <RotateCcw size={15} />
                <span>Scan Another Leaf</span>
              </button>

              {scanLogged && (
                <div className="scan-logged-pill">
                  <CheckCircle size={14} />
                  <span>{scanSyncPending ? 'Saved offline · sync pending' : 'Saved to Farm Scan History'}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
