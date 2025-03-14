import * as brain from 'brain.js';
import {
  TrainingSample,
  RecognitionResult,
  TrainingData,
  NetworkOptions,
  DEFAULT_NETWORK_OPTIONS
} from './models';

export class OCRService {
  private network: brain.NeuralNetwork;
  private characters = new Set<string>();
  private trainingSamples: TrainingSample[] = [];
  private options: NetworkOptions;
  private trainingStatus: 'idle' | 'training' | 'trained' = 'idle';
  private trainingProgress = 0;
  private onProgressCallback: ((progress: number) => void) | null = null;

  constructor(options: Partial<NetworkOptions> = {}) {
    this.options = { ...DEFAULT_NETWORK_OPTIONS, ...options };
    this.initNetwork();
  }

  private initNetwork() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: this.options.hiddenLayers,
      learningRate: this.options.learningRate
    });
  }

  // Add a sample to the training set
  addSample(sample: TrainingSample): void {
    this.trainingSamples.push(sample);
    this.characters.add(sample.label);
    this.trainingStatus = 'idle'; // Reset training status when new data is added
  }

  // Remove a sample by ID
  removeSample(id: string): void {
    this.trainingSamples = this.trainingSamples.filter(s => s.id !== id);

    // Recalculate unique characters
    this.characters = new Set<string>();
    this.trainingSamples.forEach(s => this.characters.add(s.label));

    this.trainingStatus = 'idle'; // Reset training status when data changes
  }

  // Clear all training data
  clearData(): void {
    this.trainingSamples = [];
    this.characters = new Set<string>();
    this.trainingStatus = 'idle';
  }

  // Check if we have any training data
  hasData(): boolean {
    return this.trainingSamples.length > 0;
  }

  // Get all characters in the training set
  getCharacters(): string[] {
    return Array.from(this.characters).sort();
  }

  // Get all training samples
  getTrainingSamples(): TrainingSample[] {
    return [...this.trainingSamples];
  }

  // Count samples for each character
  getSampleCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.trainingSamples.forEach(sample => {
      if (!counts[sample.label]) {
        counts[sample.label] = 0;
      }
      counts[sample.label]++;
    });
    return counts;
  }

  // Check if the model has been trained
  isTrained(): boolean {
    return this.trainingStatus === 'trained';
  }

  // Get current training status
  getTrainingStatus(): 'idle' | 'training' | 'trained' {
    return this.trainingStatus;
  }

  // Register a callback for training progress updates
  onProgress(callback: (progress: number) => void): void {
    this.onProgressCallback = callback;
  }

  // Prepare data for training
  private prepareTrainingData(): TrainingData[] {
    const characters = this.getCharacters();

    return this.trainingSamples.map(sample => {
      // Prepare the one-hot output encoding
      const output: { [key: string]: number } = {};
      characters.forEach(c => output[c] = 0); // Initialize all to 0
      output[sample.label] = 1; // Set the correct label to 1

      return {
        input: sample.imageData,
        output
      };
    });
  }

  // Train the network
  async train(): Promise<void> {
    if (this.trainingSamples.length === 0) {
      throw new Error('No training samples available');
    }

    if (this.characters.size < 2) {
      throw new Error('Need at least 2 different characters to train');
    }

    this.trainingStatus = 'training';
    this.trainingProgress = 0;

    // Prepare the training data
    const trainingData = this.prepareTrainingData();

    // Initialize a new network to start fresh
    this.initNetwork();

    // Train with progress reporting
    return new Promise((resolve, reject) => {
      try {
        this.network.train(trainingData, {
          iterations: this.options.iterations,
          errorThresh: this.options.errorThresh,
          log: true,
          logPeriod: 10,
          callback: (data) => {
            const progress = data.iterations / this.options.iterations;
            this.trainingProgress = progress;
            if (this.onProgressCallback) {
              this.onProgressCallback(progress);
            }
          }
        });

        this.trainingStatus = 'trained';
        this.trainingProgress = 1;
        if (this.onProgressCallback) {
          this.onProgressCallback(1);
        }

        resolve();
      } catch (error) {
        this.trainingStatus = 'idle';
        reject(error);
      }
    });
  }

  // Recognize a character from image data
  recognize(imageData: number[]): RecognitionResult | null {
    if (this.trainingStatus !== 'trained' || this.characters.size === 0) {
      return null;
    }

    // Get the raw output from the network
    const output = this.network.run(imageData);

    // Sort characters by confidence
    const characters = this.getCharacters();
    const results = characters.map(char => ({
      character: char,
      confidence: output[char] || 0
    }));

    // Sort by confidence (descending)
    results.sort((a, b) => b.confidence - a.confidence);

    // Format the recognition result
    return {
      character: results[0].character,
      confidence: results[0].confidence,
      alternatives: results.slice(1, 5) // Return the top 4 alternatives
    };
  }

  // Export model to JSON
  exportModel(): string {
    if (this.trainingStatus !== 'trained') {
      throw new Error('Model not trained yet');
    }
    const modelData = this.network.toJSON();
    return JSON.stringify(modelData);
  }

  // Import model from JSON
  importModel(json: string): void {
    try {
      const modelData = JSON.parse(json);
      this.initNetwork(); // Initialize a fresh network first
      this.network.fromJSON(modelData);
      this.trainingStatus = 'trained'; // Mark as trained
      console.log('Model successfully imported');
    } catch (error) {
      console.error('Model import error:', error);
      throw new Error('Invalid model data: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  // Export training data to JSON
  exportTrainingData(): string {
    return JSON.stringify(this.trainingSamples);
  }

  // Import training data from JSON
  importTrainingData(json: string): void {
    try {
      const samples = JSON.parse(json) as TrainingSample[];
      this.trainingSamples = samples;

      // Rebuild the character set
      this.characters = new Set<string>();
      this.trainingSamples.forEach(s => this.characters.add(s.label));

      this.trainingStatus = 'idle';
    } catch (error) {
      throw new Error('Invalid training data');
    }
  }
}
