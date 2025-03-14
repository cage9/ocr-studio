import './style.css';
import { v4 as uuidv4 } from 'uuid';
import { saveAs } from 'file-saver';
import { OCRService } from './ocrService';
import { setupCanvas, extractImageData, createThumbnail } from './canvasUtils';
import { TrainingSample, RecognitionResult } from './models';

// Initialize OCR service
const ocrService = new OCRService();

// Set up canvas elements
const { canvas: trainCanvas, ctx: trainCtx, clearCanvas: clearTrainCanvas } =
  setupCanvas('trainCanvas');
const { canvas: testCanvas, ctx: testCtx, clearCanvas: clearTestCanvas } =
  setupCanvas('testCanvas');

// Get UI elements
// Tab elements
const trainTab = document.getElementById('trainTab') as HTMLButtonElement;
const testTab = document.getElementById('testTab') as HTMLButtonElement;
const dataTab = document.getElementById('dataTab') as HTMLButtonElement;

const trainSection = document.getElementById('trainSection') as HTMLDivElement;
const testSection = document.getElementById('testSection') as HTMLDivElement;
const dataSection = document.getElementById('dataSection') as HTMLDivElement;

// Training elements
const charInput = document.getElementById('charInput') as HTMLInputElement;
const addSampleBtn = document.getElementById('addSample') as HTMLButtonElement;
const clearTrainCanvasBtn = document.getElementById('clearTrainCanvas') as HTMLButtonElement;
const startTrainingBtn = document.getElementById('startTraining') as HTMLButtonElement;
const sampleCounter = document.getElementById('sampleCounter') as HTMLDivElement;
const charDistribution = document.getElementById('charDistribution') as HTMLDivElement;
const trainingStatus = document.getElementById('trainingStatus') as HTMLDivElement;
const trainingProgress = document.getElementById('trainingProgress') as HTMLDivElement;

// Testing elements
const recognizeBtn = document.getElementById('recognize') as HTMLButtonElement;
const clearTestCanvasBtn = document.getElementById('clearTestCanvas') as HTMLButtonElement;
const recognitionResult = document.getElementById('recognitionResult') as HTMLDivElement;
const confidenceDisplay = document.getElementById('confidenceDisplay') as HTMLDivElement;

// Data management elements
const saveModelBtn = document.getElementById('saveModel') as HTMLButtonElement;
const loadModelInput = document.getElementById('loadModel') as HTMLInputElement;
const saveTrainingDataBtn = document.getElementById('saveTrainingData') as HTMLButtonElement;
const loadTrainingDataInput = document.getElementById('loadTrainingData') as HTMLInputElement;
const clearAllDataBtn = document.getElementById('clearAllData') as HTMLButtonElement;
const samplesGrid = document.getElementById('samplesGrid') as HTMLDivElement;

// Tab switching functionality
function switchTab(tab: 'train' | 'test' | 'data') {
  // Hide all sections
  trainSection.classList.remove('active');
  testSection.classList.remove('active');
  dataSection.classList.remove('active');

  // Remove active class from all tabs
  trainTab.classList.remove('active');
  testTab.classList.remove('active');
  dataTab.classList.remove('active');

  // Activate the selected tab and section
  switch (tab) {
    case 'train':
      trainSection.classList.add('active');
      trainTab.classList.add('active');
      break;
    case 'test':
      testSection.classList.add('active');
      testTab.classList.add('active');
      break;
    case 'data':
      dataSection.classList.add('active');
      dataTab.classList.add('active');
      updateSamplesGrid();
      break;
  }
}

// Tab event listeners
trainTab.addEventListener('click', () => switchTab('train'));
testTab.addEventListener('click', () => switchTab('test'));
dataTab.addEventListener('click', () => switchTab('data'));

// Training functionality
addSampleBtn.addEventListener('click', () => addTrainingSample());
clearTrainCanvasBtn.addEventListener('click', clearTrainCanvas);
startTrainingBtn.addEventListener('click', startTraining);

// Helper function to add a training sample
function addTrainingSample() {
  const character = charInput.value.trim();

  if (!character) {
    alert('Please enter a character');
    return;
  }

  // Extract image data from the canvas
  const imageData = extractImageData(trainCanvas);

  // Create a new TrainingSample
  const sample: TrainingSample = {
    imageData,
    label: character,
    id: uuidv4()
  };

  // Add the sample to the OCR service
  ocrService.addSample(sample);

  // Update the UI
  updateSampleCountUI();

  // Clear the canvas and input
  clearTrainCanvas();
  charInput.value = '';
  charInput.focus();
}

// Update sample count display
function updateSampleCountUI() {
  const samples = ocrService.getTrainingSamples();
  sampleCounter.textContent = `Samples: ${samples.length}`;

  // Update character distribution
  const counts = ocrService.getSampleCounts();
  charDistribution.innerHTML = '';

  Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([char, count]) => {
      const charCounter = document.createElement('div');
      charCounter.className = 'char-counter';
      charCounter.innerHTML = `<span>${char}</span><span>(${count})</span>`;
      charDistribution.appendChild(charCounter);
    });

  // Update start training button state
  startTrainingBtn.disabled = samples.length < 10 || Object.keys(counts).length < 2;
  if (samples.length < 10 || Object.keys(counts).length < 2) {
    trainingStatus.textContent = 'Need at least 10 samples and 2 characters to train';
  } else {
    trainingStatus.textContent = 'Ready to train';
  }
}

// Start training the model
async function startTraining() {
  if (!ocrService.hasData() || ocrService.getCharacters().length < 2) {
    alert('Need at least 2 different characters to train');
    return;
  }

  startTrainingBtn.disabled = true;
  trainingStatus.textContent = 'Training in progress...';
  trainingProgress.style.width = '0%';

  // Register progress callback
  ocrService.onProgress((progress) => {
    trainingProgress.style.width = `${progress * 100}%`;
  });

  try {
    await ocrService.train();
    trainingStatus.textContent = 'Training complete!';
    testTab.click(); // Switch to test tab when training is complete
  } catch (error) {
    console.error('Training error:', error);
    trainingStatus.textContent = `Training error: ${error.message}`;
  } finally {
    startTrainingBtn.disabled = false;
  }
}

// Testing functionality
recognizeBtn.addEventListener('click', recognizeCharacter);
clearTestCanvasBtn.addEventListener('click', clearTestCanvas);

// Recognize character from test canvas
function recognizeCharacter() {
  if (!ocrService.isTrained()) {
    recognitionResult.textContent = 'Please train the model first';
    return;
  }

  // Extract image data from the test canvas
  const imageData = extractImageData(testCanvas);

  // Get recognition result
  const result: RecognitionResult | null = ocrService.recognize(imageData);

  if (!result) {
    recognitionResult.textContent = 'Could not recognize the character';
    confidenceDisplay.innerHTML = '';
    return;
  }

  // Display the top result
  recognitionResult.textContent = `Recognized as: ${result.character} (${(result.confidence * 100).toFixed(2)}%)`;

  // Display confidence bars for alternatives
  confidenceDisplay.innerHTML = '';

  // Add the top result
  addConfidenceBar(result.character, result.confidence);

  // Add alternatives
  result.alternatives.forEach(alt => {
    addConfidenceBar(alt.character, alt.confidence);
  });
}

// Create a confidence bar for a character
function addConfidenceBar(character: string, confidence: number) {
  const container = document.createElement('div');
  container.className = 'confidence-bar';

  const label = document.createElement('div');
  label.className = 'confidence-label';
  label.textContent = character;

  const meter = document.createElement('div');
  meter.className = 'confidence-meter';

  const value = document.createElement('div');
  value.className = 'confidence-value';
  value.style.width = `${confidence * 100}%`;

  const percentage = document.createElement('div');
  percentage.className = 'confidence-percentage';
  percentage.textContent = `${(confidence * 100).toFixed(1)}%`;

  meter.appendChild(value);
  container.appendChild(label);
  container.appendChild(meter);
  container.appendChild(percentage);

  confidenceDisplay.appendChild(container);
}

// Data management functionality
saveModelBtn.addEventListener('click', saveModel);
loadModelInput.addEventListener('change', loadModel);
saveTrainingDataBtn.addEventListener('click', saveTrainingData);
loadTrainingDataInput.addEventListener('change', loadTrainingData);
clearAllDataBtn.addEventListener('click', clearAllData);

// Save model to file
function saveModel() {
  if (!ocrService.isTrained()) {
    alert('Please train the model first');
    return;
  }

  const modelData = ocrService.exportModel();
  const blob = new Blob([modelData], { type: 'application/json' });
  saveAs(blob, 'ocr-model.json');
}

// Load model from file
function loadModel(event: Event) {
  const input = event.target as HTMLInputElement;

  if (!input.files || input.files.length === 0) {
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      if (!e.target || typeof e.target.result !== 'string') {
        throw new Error('Failed to read file');
      }

      const json = e.target.result;
      console.log('Loading model from JSON, size:', json.length);

      ocrService.importModel(json);
      alert('Model loaded successfully');

      // Enable testing tab after model is loaded
      testTab.click();

      // Reset the input
      input.value = '';
    } catch (error) {
      console.error('Model loading error:', error);
      alert(`Error loading model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  reader.onerror = function() {
    alert('Error reading file');
  };

  reader.readAsText(file);
}

// Save training data to file
function saveTrainingData() {
  if (!ocrService.hasData()) {
    alert('No training data to save');
    return;
  }

  const data = ocrService.exportTrainingData();
  const blob = new Blob([data], { type: 'application/json' });
  saveAs(blob, 'ocr-training-data.json');
}

// Load training data from file
function loadTrainingData(event: Event) {
  const input = event.target as HTMLInputElement;

  if (!input.files || input.files.length === 0) {
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const json = e.target?.result as string;
      ocrService.importTrainingData(json);
      alert('Training data loaded successfully');

      // Update UI
      updateSampleCountUI();
      updateSamplesGrid();

      // Reset the input
      input.value = '';
    } catch (error) {
      alert(`Error loading training data: ${error.message}`);
    }
  };

  reader.readAsText(file);
}

// Clear all training data
function clearAllData() {
  if (confirm('Are you sure you want to clear all training data?')) {
    ocrService.clearData();
    updateSampleCountUI();
    updateSamplesGrid();
    trainingStatus.textContent = 'No training data';
    trainingProgress.style.width = '0%';
  }
}

// Update the samples grid display
function updateSamplesGrid() {
  samplesGrid.innerHTML = '';

  const samples = ocrService.getTrainingSamples();

  samples.forEach(sample => {
    const sampleItem = document.createElement('div');
    sampleItem.className = 'sample-item';

    // Create thumbnail canvas
    const thumbnail = createThumbnail(sample.imageData, sample.label);

    // Add label
    const label = document.createElement('div');
    label.className = 'sample-label';
    label.textContent = sample.label;

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'sample-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      ocrService.removeSample(sample.id);
      updateSampleCountUI();
      updateSamplesGrid();
    });

    sampleItem.appendChild(thumbnail);
    sampleItem.appendChild(label);
    sampleItem.appendChild(deleteBtn);

    samplesGrid.appendChild(sampleItem);
  });
}

// Initialize the UI
updateSampleCountUI();
switchTab('train');
