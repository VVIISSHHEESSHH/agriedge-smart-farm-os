/**
 * AgriSnap In-Browser TensorFlow.js Inference Service
 *
 * Dedicated to local, client-side leaf disease screening.
 * Ensures:
 * 1. ZERO image uploads to cloud/backend.
 * 2. Real neural tensor preprocessing ([1, 224, 224, 3], normalized [0, 1]).
 * 3. Exact index mapping to 10 PlantVillage Tomato classes.
 * 4. Transparent handling when genuine model weights are pending deployment.
 */

import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

export interface DiseaseClassMeta {
  index: number;
  key: string;
  display_name_en: string;
  display_name_hi: string;
  is_healthy: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  guidance_en: string;
  guidance_hi: string;
}

export interface ModelMetadata {
  model_name: string;
  version: string;
  architecture: string;
  input_shape: number[];
  classes_count: number;
  confidence_threshold: number;
  classes: DiseaseClassMeta[];
}

export interface PredictionResult {
  topMatch: DiseaseClassMeta;
  confidence: number;
  allProbabilities: { className: string; probability: number }[];
  isUncertain: boolean;
  isHealthy: boolean;
  inferenceDurationMs: number;
  modelVersion: string;
  engine: 'tflite' | 'tfjs';
}

class AgriSnapInferenceService {
  private tfliteModel: tflite.TFLiteModel | null = null;
  private tfjsModel: tf.LayersModel | tf.GraphModel | null = null;
  private metadata: ModelMetadata | null = null;
  private isModelAvailable: boolean = false;
  private loadError: string | null = null;
  private activeEngine: 'tflite' | 'tfjs' | null = null;

  private tfliteUrl = '/models/plant-disease/model.tflite';
  private tfjsModelUrl = '/models/plant-disease/model.json';
  private metadataUrl = '/models/plant-disease/metadata.json';
  private wasmPath = '/tflite-wasm/';

  /**
   * Pre-load metadata and attempt to load real model weights
   */
  async initialize(): Promise<{ available: boolean; error: string | null; meta: ModelMetadata | null }> {
    try {
      const metaRes = await fetch(this.metadataUrl);
      if (!metaRes.ok) throw new Error(`Model metadata unavailable (${metaRes.status}).`);
      const metadata = await metaRes.json() as ModelMetadata;
      this.metadata = metadata;
      this.validateMetadata(metadata);

      try {
        tflite.setWasmPath(this.wasmPath);
        this.tfliteModel = await tflite.loadTFLiteModel(this.tfliteUrl);
        this.isModelAvailable = true;
        this.activeEngine = 'tflite';
        this.loadError = null;
        return { available: true, error: null, meta: this.metadata };
      } catch (tfliteErr) {
        console.warn('TFLite weights/runtime could not be loaded; checking a real TFJS fallback.', tfliteErr);
      }

      const tfjsCheck = await fetch(this.tfjsModelUrl);
      if (tfjsCheck.ok && !tfjsCheck.headers.get('content-type')?.includes('text/html')) {
        try {
          this.tfjsModel = await tf.loadLayersModel(this.tfjsModelUrl);
        } catch {
          this.tfjsModel = await tf.loadGraphModel(this.tfjsModelUrl);
        }
        this.isModelAvailable = true;
        this.activeEngine = 'tfjs';
        this.loadError = null;
        return { available: true, error: null, meta: this.metadata };
      }

      this.isModelAvailable = false;
      this.loadError = 'Genuine model file (model.tflite) not found in /models/plant-disease/.';
      return { available: false, error: this.loadError, meta: this.metadata };
    } catch (err: any) {
      this.isModelAvailable = false;
      this.loadError = err.message || 'Failed to load TensorFlow Lite model weights.';
      return { available: false, error: this.loadError, meta: this.metadata };
    }
  }

  private validateMetadata(metadata: ModelMetadata): void {
    if (metadata.input_shape?.join(',') !== '1,224,224,3') {
      throw new Error(`Unsupported model input shape: ${metadata.input_shape?.join('x') ?? 'unknown'}.`);
    }
    if (!Array.isArray(metadata.classes) || metadata.classes.length !== metadata.classes_count || metadata.classes_count !== 10) {
      throw new Error('Tomato model metadata must define the complete 10-class output mapping.');
    }
    metadata.classes.forEach((item, index) => {
      if (item.index !== index || !item.display_name_en || !item.guidance_en) {
        throw new Error(`Tomato model metadata has an invalid class entry at index ${index}.`);
      }
    });
  }


  isReady(): boolean {
    return this.isModelAvailable && (this.tfliteModel !== null || this.tfjsModel !== null);
  }

  getActiveEngine(): 'tflite' | 'tfjs' | null {
    return this.activeEngine;
  }

  getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  /**
   * Run local inference on HTMLImageElement or HTMLCanvasElement
   */
  async predict(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<PredictionResult> {
    if (!this.metadata) {
      const res = await fetch(this.metadataUrl);
      this.metadata = await res.json();
    }

    if (!this.tfliteModel && !this.tfjsModel) {
      throw new Error(
        'Genuine model weights are not loaded. Ensure model.tflite is installed in /models/plant-disease/.'
      );
    }

    const startTime = performance.now();

    // 1. Convert pixels to Tensor, resize to [224, 224], normalize to [0, 1]
    const tensor = tf.tidy(() => {
      return tf.browser
        .fromPixels(imageElement)
        .resizeBilinear([224, 224])
        .toFloat()
        .div(tf.scalar(255.0))
        .expandDims(0); // Shape [1, 224, 224, 3]
    });

    // 2. Execute genuine inference
    let outputTensor: tf.Tensor;
    try {
      if (this.activeEngine === 'tflite' && this.tfliteModel) {
        const rawOutput = this.tfliteModel.predict(tensor);
        if (rawOutput instanceof tf.Tensor) {
          outputTensor = rawOutput;
        } else if (Array.isArray(rawOutput)) {
          outputTensor = rawOutput[0];
        } else {
          const firstKey = Object.keys(rawOutput)[0];
          outputTensor = rawOutput[firstKey];
        }
      } else if (this.tfjsModel) {
        const rawOutput = this.tfjsModel.predict(tensor);
        if (Array.isArray(rawOutput)) {
          outputTensor = rawOutput[0];
        } else {
          outputTensor = rawOutput as tf.Tensor;
        }
      } else {
        tensor.dispose();
        throw new Error('No active neural runtime available.');
      }
    } catch (inferErr: any) {
      tensor.dispose();
      throw new Error(`Inference execution failed: ${inferErr.message}`);
    }

    if (tensor.shape.join(',') !== this.metadata!.input_shape.join(',')) {
      const actual = tensor.shape.join('x');
      tensor.dispose();
      outputTensor.dispose();
      throw new Error(`Preprocessing produced ${actual}; expected ${this.metadata!.input_shape.join('x')}.`);
    }
    if (outputTensor.size !== this.metadata!.classes_count) {
      const actual = outputTensor.shape.join('x');
      tensor.dispose();
      outputTensor.dispose();
      throw new Error(`Model returned ${actual}; expected ${this.metadata!.classes_count} class scores.`);
    }

    const probabilities = (await outputTensor.data()) as Float32Array;

    // Clean up tensor memory
    tensor.dispose();
    outputTensor.dispose();

    const duration = performance.now() - startTime;

    // 3. Map probabilities to metadata classes
    let maxIndex = 0;
    let maxProb = 0;
    const allProbs = [];

    for (let i = 0; i < probabilities.length; i++) {
      const prob = probabilities[i];
      if (!Number.isFinite(prob) || prob < 0 || prob > 1) {
        throw new Error('Model output contains invalid class scores; no diagnosis was produced.');
      }
      const classMeta = this.metadata!.classes[i];

      allProbs.push({
        className: classMeta.display_name_en,
        probability: Math.round(prob * 1000) / 10, // e.g. 89.4%
      });

      if (prob > maxProb) {
        maxProb = prob;
        maxIndex = i;
      }
    }

    const topMatch = this.metadata!.classes[maxIndex] || this.metadata!.classes[0];
    const threshold = this.metadata!.confidence_threshold || 0.55;
    const isUncertain = maxProb < threshold;

    return {
      topMatch,
      confidence: Math.round(maxProb * 1000) / 10,
      allProbabilities: allProbs.sort((a, b) => b.probability - a.probability),
      isUncertain,
      isHealthy: topMatch.is_healthy,
      inferenceDurationMs: Math.round(duration),
      modelVersion: this.metadata!.version,
      engine: this.activeEngine || 'tflite',
    };
  }
}

export const agriSnapService = new AgriSnapInferenceService();
