// Models for OCR application

// Define interfaces for our application

// Training Sample containing an image and its label
export interface TrainingSample {
  imageData: number[]; // Normalized pixel data (grayscale, 0-1)
  label: string;       // Character label
  id: string;          // Unique identifier for this sample
}

// Recognition Result with character predictions and confidence scores
export interface RecognitionResult {
  character: string;      // Top prediction
  confidence: number;     // Confidence score for top prediction (0-1)
  alternatives: {         // Alternative predictions with their scores
    character: string;
    confidence: number;
  }[];
}

// Neural Network Training Data
export interface TrainingData {
  input: number[];      // Normalized image data
  output: {              // One-hot encoded output
    [key: string]: number;
  };
}

// Options for the neural network
export interface NetworkOptions {
  hiddenLayers: number[];  // Number of neurons in each hidden layer
  iterations: number;      // Maximum training iterations
  learningRate: number;    // Learning rate
  errorThresh: number;     // Error threshold to stop training
}

// Default network configuration
export const DEFAULT_NETWORK_OPTIONS: NetworkOptions = {
  hiddenLayers: [100],
  iterations: 2000,
  learningRate: 0.1,
  errorThresh: 0.005
};

// Canvas settings
export const CANVAS_SIZE = 280; // Size of the drawing canvas
export const NORMALIZE_SIZE = 28; // Size to normalize to for the network
