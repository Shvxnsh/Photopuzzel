const $ = (selector) => document.querySelector(selector);

const puzzle = $('#puzzle');
const gridSizeInput = $('#gridSize');
const gridValue = $('#gridValue');
const placedCount = $('#placedCount');
const totalCount = $('#totalCount');
const moveCount = $('#moveCount');
const statusText = $('#statusText');
const winBadge = $('#winBadge');
const stripCanvas = $('#stripCanvas');
const placeholder = $('#stripPlaceholder');
const downloadButton = $('#downloadButton');
const printButton = $('#printButton');
const modal = $('#cameraModal');
const video = $('#cameraVideo');
const takePhotoButton = $('#takePhoto');

let imageSrc = null;
let selected = null;
let tiles = [];
let moves = 0;
let solved = false;
let stream = null;

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function renderPuzzle(shouldShuffle = true) {
  const size = Number(gridSizeInput.value);
  const total = size * size;
  totalCount.textContent = total;
  gridValue.textContent = `${size} × ${size}`;
  selected = null;
  moves = 0;
  solved = false;
  winBadge.hidden = true;
  moveCount.textContent = '0';
  puzzle.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  if (!imageSrc) {
    tiles = [];
    placedCount.textContent = '0';
    puzzle.innerHTML = '<div class="empty-puzzle"><div><span>◎</span>Take a picture<br>to begin</div></div>';
    drawStrip(false);
    return;
  }

  tiles = Array.from({ length: total }, (_, index) => index);
  if (shouldShuffle) do shuffle(tiles); while (tiles.every((piece, index) => piece === index));
  statusText.textContent = 'Click two pieces to swap them.';
  drawTiles();
  drawStrip(false);
}

function drawTiles() {
  const size = Number(gridSizeInput.value);
  puzzle.replaceChildren();
  tiles.forEach((piece, position) => {
    const tile = document.createElement('button');
    const x = piece % size;
    const y = Math.floor(piece / size);
    tile.className = 'tile';
    tile.type = 'button';
    tile.dataset.number = piece + 1;
    tile.setAttribute('aria-label', `Piece ${piece + 1}`);
    tile.style.backgroundImage = `url("${imageSrc}")`;
    tile.style.backgroundPosition = `${x * 100 / (size - 1)}% ${y * 100 / (size - 1)}%`;
    if (piece === position) tile.classList.add('correct');
    if (position === selected) tile.classList.add('selected');
    tile.addEventListener('click', () => chooseTile(position));
    puzzle.appendChild(tile);
  });
  placedCount.textContent = tiles.filter((piece, index) => piece === index).length;
}

function chooseTile(position) {
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
  const context = stripCanvas.getContext('2d');
  const width = stripCanvas.width;
  context.fillStyle = '#f8fbf9';
  context.fillRect(0, 0, width, stripCanvas.height);
  context.textAlign = 'center';
  context.fillStyle = '#263432';
  context.font = '500 24px Fraunces';
  context.fillText('photopuzzel', width / 2, 34);
  context.fillStyle = '#71817c';
  context.font = '11px DM Mono';
  context.fillText('A REAL MOMENT / 2024', width / 2, 54);
  placeholder.hidden = show;
  downloadButton.disabled = !show;
  printButton.disabled = !show;
  if (!imageSrc) return;
  const image = new Image();
  image.onload = () => {
    for (let index = 0; index < 3; index += 1) {
      const y = 72 + index * 160;
      context.drawImage(image, 25, y, 310, 145);
      context.strokeStyle = '#cbd9d4';
      context.strokeRect(25, y, 310, 145);
    }
    context.fillStyle = '#4d766f';
    context.font = '24px Fraunces';
    context.fillText(show ? '✳ solved it ✳' : 'your next adventure', width / 2, 570);
    context.fillStyle = '#71817c';
    context.font = '10px DM Mono';
    context.fillText('KEEP THIS ONE', width / 2, 602);
  };
  image.src = imageSrc;
}

gridSizeInput.addEventListener('input', () => renderPuzzle(true));
$('#shuffleButton').addEventListener('click', () => { if (imageSrc) renderPuzzle(true); });
$('#resetAll').addEventListener('click', () => {
  imageSrc = null;
  $('#puzzleTitle').textContent = 'Waiting for a picture';
  statusText.textContent = 'Take a picture to begin.';
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

function setCameraMessage(message) {
  $('#cameraNote').textContent = message;
  takePhotoButton.disabled = true;
}

function waitForVideo() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => reject(new Error('The camera did not return a video feed.')), 10000);
    video.addEventListener('loadedmetadata', () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function openCamera() {
  if (!window.isSecureContext) throw new Error('Open the Vercel URL using HTTPS, not HTTP.');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser does not provide camera access. Try Chrome, Edge, Safari, or Firefox.');
  }

  // Some laptop webcams reject facingMode. Start with the most compatible request.
  const requests = [
    { video: { facingMode: { ideal: 'user' } }, audio: false },
    { video: true, audio: false }
  ];
  let lastError;
  for (const constraints of requests) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') break;
    }
  }
  throw lastError || new Error('Unable to access a camera.');
}

$('#cameraButton').addEventListener('click', async () => {
  modal.hidden = false;
  $('#cameraNote').textContent = 'Allow camera access when your browser asks.';
  takePhotoButton.disabled = true;
  try {
    stream = await openCamera();
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await waitForVideo();
    takePhotoButton.disabled = false;
    $('#cameraNote').textContent = 'Camera ready.';
  } catch (error) {
    const messages = {
      NotAllowedError: 'Camera permission was blocked. Click the camera icon in the address bar, allow access, then reload.',
      NotFoundError: 'No camera was found. Connect a webcam and try again.',
      NotReadableError: 'The camera is being used by another app. Close it and try again.',
      OverconstrainedError: 'This camera does not support the requested mode. Try again.'
    };
    setCameraMessage(messages[error.name] || `${error.message} Make sure this is the HTTPS Vercel URL.`);
  }
});

function closeCamera() {
  modal.hidden = true;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  takePhotoButton.disabled = true;
}

$('#closeCamera').addEventListener('click', closeCamera);
$('#takePhoto').addEventListener('click', () => {
  if (!video.videoWidth || !video.videoHeight) {
    setCameraMessage('Camera is still starting. Try again in a moment.');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  setImage(canvas.toDataURL('image/jpeg', 0.9));
  closeCamera();
});

renderPuzzle(false);
