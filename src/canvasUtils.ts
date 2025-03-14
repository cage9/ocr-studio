import { NORMALIZE_SIZE } from './models';

// Set up the drawing canvas
export function setupCanvas(canvasId: string): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  clearCanvas: () => void;
} {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // Set canvas styles
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#FFFFFF';

  // Variables to track drawing state
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Drawing event listeners
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    lastX = e.offsetX;
    lastY = e.offsetY;
  });

  canvas.addEventListener('mouseup', () => {
    isDrawing = false;
  });

  canvas.addEventListener('mouseout', () => {
    isDrawing = false;
  });

  // Touch events for mobile
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.touches[0].clientX - rect.left;
    lastY = e.touches[0].clientY - rect.top;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const touchY = e.touches[0].clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(touchX, touchY);
    ctx.stroke();

    lastX = touchX;
    lastY = touchY;
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDrawing = false;
  });

  // Function to clear the canvas
  const clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return { canvas, ctx, clearCanvas };
}

// Extract normalized image data from canvas
export function extractImageData(canvas: HTMLCanvasElement): number[] {
  // Create a temporary canvas for processing
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = NORMALIZE_SIZE;
  tempCanvas.height = NORMALIZE_SIZE;
  const tempCtx = tempCanvas.getContext('2d')!;

  // Find the bounding box of the drawn content
  const sourceData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const boundingBox = findBoundingBox(sourceData);

  // If nothing was drawn, return array of zeros
  if (!boundingBox) {
    return new Array(NORMALIZE_SIZE * NORMALIZE_SIZE).fill(0);
  }

  // Extract the drawn content and centralize it
  const { left, top, right, bottom } = boundingBox;
  const width = right - left;
  const height = bottom - top;

  // Calculate the aspect ratio
  const aspectRatio = width / height;

  // Determine the size to ensure it fits in the normalized canvas
  let targetWidth, targetHeight;
  if (aspectRatio > 1) {
    targetWidth = NORMALIZE_SIZE - 4; // 2px padding on each side
    targetHeight = targetWidth / aspectRatio;
  } else {
    targetHeight = NORMALIZE_SIZE - 4; // 2px padding on each side
    targetWidth = targetHeight * aspectRatio;
  }

  // Calculate centering
  const offsetX = (NORMALIZE_SIZE - targetWidth) / 2;
  const offsetY = (NORMALIZE_SIZE - targetHeight) / 2;

  // Clear the temporary canvas
  tempCtx.clearRect(0, 0, NORMALIZE_SIZE, NORMALIZE_SIZE);

  // Draw the content centered on the temporary canvas
  tempCtx.drawImage(
    canvas,
    left, top, width, height,
    offsetX, offsetY, targetWidth, targetHeight
  );

  // Get the pixel data from the temporary canvas
  const imageData = tempCtx.getImageData(0, 0, NORMALIZE_SIZE, NORMALIZE_SIZE);

  // Normalize the data to values between 0 and 1 (extracting only grayscale)
  const normalizedData: number[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    // Use the red channel as all channels should have the same value for white
    const pixelValue = imageData.data[i] / 255;
    normalizedData.push(pixelValue);
  }

  return normalizedData;
}

// Find the bounding box of the drawn content
function findBoundingBox(imageData: ImageData): { left: number, top: number, right: number, bottom: number } | null {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  // Scan through the image data to find the bounding box
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Check if pixel is not black (assuming white drawing on black canvas)
      if (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        found = true;
      }
    }
  }

  // If nothing was found, return null
  if (!found) {
    return null;
  }

  // Add a small padding
  minX = Math.max(0, minX - 5);
  minY = Math.max(0, minY - 5);
  maxX = Math.min(width, maxX + 5);
  maxY = Math.min(height, maxY + 5);

  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY
  };
}

// Convert normal-sized image to tiny for display
export function createThumbnail(imageData: number[], character: string): HTMLCanvasElement {
  const thumbnailCanvas = document.createElement('canvas');
  thumbnailCanvas.width = NORMALIZE_SIZE;
  thumbnailCanvas.height = NORMALIZE_SIZE;
  thumbnailCanvas.className = 'sample-canvas';
  const ctx = thumbnailCanvas.getContext('2d')!;

  // Create image from data
  const imgData = ctx.createImageData(NORMALIZE_SIZE, NORMALIZE_SIZE);
  for (let i = 0; i < imageData.length; i++) {
    const j = i * 4;
    const value = imageData[i] * 255;
    imgData.data[j] = value;     // R
    imgData.data[j + 1] = value; // G
    imgData.data[j + 2] = value; // B
    imgData.data[j + 3] = 255;   // A
  }

  ctx.putImageData(imgData, 0, 0);
  return thumbnailCanvas;
}
