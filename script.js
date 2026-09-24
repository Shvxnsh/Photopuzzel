const $ = (selector) => document.querySelector(selector);

const puzzle = $('#puzzle');
const gridSize = $('#gridSize');
const placedCount = $('#placedCount');
const totalCount = $('#totalCount');
const moveCount = $('#moveCount');
const statusText = $('#statusText');
const winBadge = $('#winBadge');
const stripCanvas = $('#stripCanvas');
const placeholder = $('#stripPlaceholder');
const downloadButton = $('#downloadButton');
const printButton = $('#printButton');
const video = $('#cameraVideo');
const modal = $('#cameraModal');
const takePhotoButton = $('#takePhoto');
const countdownEl = $('#countdown');
const gestureText = $('#gestureText');
const gestureHint = $('#gestureHint');
const gestureIcon = $('#gestureIcon');
const cameraNote = $('#cameraNote');

let imageSrc = null;
let tiles = [];
let selected = null;
let moves = 0;
let solved = false;
let cameraStream = null;
let cameraOpening = false;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderPuzzle(shouldShuffle = true) {
  const size = Number(gridSize.value);
  const total = size * size;
  $('#gridValue').textContent = `${size} × ${size}`;
  totalCount.textContent = total;
  moveCount.textContent = '0';
  selected = null;
  moves = 0;
  solved = false;
  winBadge.hidden = true;
  puzzle.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  if (!imageSrc) {
    tiles = [];
    placedCount.textContent = '0';
    puzzle.innerHTML = '<div class="empty-puzzle"><div><span>◎</span>Take a picture<br>to begin</div></div>';
    drawStrip(false);
    return;
  }

  tiles = Array.from({ length: total }, (_, index) => index);
  if (shouldShuffle) {
    do shuffle(tiles);
    while (tiles.every((piece, index) => piece === index));
  }
  statusText.textContent = 'Click two pieces to swap them.';
  drawTiles();
  drawStrip(false);
}

function drawTiles() {
  const size = Number(gridSize.value);
  puzzle.replaceChildren();
  tiles.forEach((piece, position) => {
    const tile = document.createElement('button');
    const x = piece % size;
    const y = Math.floor(piece / size);
    tile.type = 'button';
    tile.className = 'tile';
    tile.dataset.number = piece + 1;
    tile.setAttribute('aria-label', `Piece ${piece + 1}`);
    tile.style.backgroundImage = `url("${imageSrc}")`;
    tile.style.backgroundPosition = `${(x * 100) / (size - 1)}% ${(y * 100) / (size - 1)}%`;
    if (piece === position) tile.classList.add('correct');
    if (position === selected) tile.classList.add('selected');
    tile.addEventListener('click', () => chooseMove(position));
    puzzle.appendChild(tile);
  });
  placedCount.textContent = tiles.filter((piece, index) => piece === index).length;
}

function chooseMove(position) {
  if (solved) return;
  if (selected === null) {
    selected = position;
    statusText.textContent = 'Choose another piece to swap.';
    drawTiles();
    return;
  }
  if (selected === position) {
    selected = null;
    drawTiles();
    return;
  }
  [tiles[selected], tiles[position]] = [tiles[position], tiles[selected]];
  selected = null;
  moves += 1;
  moveCount.textContent = moves;
  drawTiles();
  if (tiles.every((piece, index) => piece === index)) {
    solved = true;
    statusText.textContent = 'Complete. A real moment, kept.';
    winBadge.hidden = false;
    drawStrip(true);
  }
}

function setImage(src) {
  imageSrc = src;
  $('#puzzleTitle').innerHTML = 'Your picture <span>✳</span>';
  renderPuzzle(true);
}

function drawStrip(show) {
  const ctx = stripCanvas.getContext('2d');
  ctx.fillStyle = '#f8fbf9';
  ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#263432';
  ctx.font = '500 24px Fraunces';
  ctx.fillText('photopuzzel', stripCanvas.width / 2, 34);
  ctx.fillStyle = '#71817c';
  ctx.font = '11px DM Mono';
  ctx.fillText('A REAL MOMENT / 2024', stripCanvas.width / 2, 54);
  placeholder.hidden = show;
  downloadButton.disabled = !show;
  printButton.disabled = !show;
  if (!imageSrc) return;
  const image = new Image();
  image.onload = () => {
    for (let i = 0; i < 3; i += 1) {
      const y = 72 + i * 160;
      ctx.drawImage(image, 25, y, 310, 145);
      ctx.strokeStyle = '#cbd9d4';
      ctx.strokeRect(25, y, 310, 145);
    }
    ctx.fillStyle = '#4d766f';
    ctx.font = '24px Fraunces';
    ctx.fillText(show ? '✳ solved it ✳' : 'your next adventure', stripCanvas.width / 2, 570);
    ctx.fillStyle = '#71817c';
    ctx.font = '10px DM Mono';
    ctx.fillText('KEEP THIS ONE', stripCanvas.width / 2, 602);
  };
  image.src = imageSrc;
}

function setCameraStatus(message, isError = false) {
  gestureText.textContent = message;
  gestureIcon.textContent = isError ? '!' : '◎';
  cameraNote.textContent = isError ? message : '';
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  video.pause();
  video.srcObject = null;
  takePhotoButton.disabled = true;
  countdownEl.hidden = true;
}

async function requestCamera() {
  if (!window.isSecureContext) {
    throw new Error('Camera access requires HTTPS or localhost. Open the deployed HTTPS site.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera access.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (firstError) {
    if (firstError.name === 'NotAllowedError' || firstError.name === 'SecurityError') throw firstError;
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

function waitForVideo() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => reject(new Error('The camera opened but did not provide a video frame.')), 12000);
    const ready = () => {
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', ready);
      video.removeEventListener('canplay', ready);
      resolve();
    };
    video.addEventListener('loadedmetadata', ready, { once: true });
    video.addEventListener('canplay', ready, { once: true });
  });
}

async function openCameraModal() {
  if (cameraOpening) return;
  cameraOpening = true;
  modal.hidden = false;
  takePhotoButton.disabled = true;
  setCameraStatus('Requesting camera permission…');
  stopCamera();

  try {
    cameraStream = await requestCamera();
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = cameraStream;
    await waitForVideo();
    await video.play();
    takePhotoButton.disabled = false;
    gestureText.textContent = 'Camera ready';
    gestureHint.textContent = 'Press Capture now to take the photo.';
    gestureIcon.textContent = '◎';
  } catch (error) {
    stopCamera();
    const messages = {
      NotAllowedError: 'Camera permission was denied. Allow camera access in your browser and try again.',
      NotFoundError: 'No camera was found. Connect a camera and try again.',
      NotReadableError: 'The camera is being used by another app. Close it and try again.',
      OverconstrainedError: 'This camera does not support the requested settings. Try again.'
    };
    setCameraStatus(messages[error.name] || error.message || 'Unable to start the camera.', true);
  } finally {
    cameraOpening = false;
  }
}

function captureCurrentFrame() {
  if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
    setCameraStatus('Camera is not ready yet. Wait a moment and try again.', true);
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  setImage(canvas.toDataURL('image/jpeg', 0.92));
  closeCamera();
}

function closeCamera() {
  stopCamera();
  modal.hidden = true;
}

$('#cameraButton').addEventListener('click', openCameraModal);
takePhotoButton.addEventListener('click', captureCurrentFrame);
$('#gestureToggle').addEventListener('click', () => {
  $('#gestureToggle').textContent = 'manual capture: on';
  gestureText.textContent = 'Manual capture enabled';
  gestureHint.textContent = 'Press Capture now to take the photo.';
});
$('#closeCamera').addEventListener('click', closeCamera);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeCamera();
});
$('#gridSize').addEventListener('input', () => renderPuzzle(true));
$('#shuffleButton').addEventListener('click', () => {
  if (imageSrc) renderPuzzle(true);
});
$('#resetAll').addEventListener('click', () => {
  closeCamera();
  imageSrc = null;
  $('#puzzleTitle').textContent = 'Waiting for a picture';
  statusText.textContent = 'Open the camera to begin.';
  renderPuzzle(false);
});
downloadButton.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'photopuzzel-strip.png';
  link.href = stripCanvas.toDataURL('image/png');
  link.click();
});
printButton.addEventListener('click', () => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<img style="max-width:100%" src="${stripCanvas.toDataURL('image/png')}" onload="print();close()">`);
  printWindow.document.close();
});
window.addEventListener('beforeunload', stopCamera);
renderPuzzle(false);
