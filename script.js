const $ = (selector) => document.querySelector(selector);

const video = $('#cameraVideo');
const modal = $('#cameraModal');
const startCameraButton = $('#startCamera');
const captureButton = $('#captureButton');
const cameraMessage = $('#cameraMessage');
const cameraError = $('#cameraError');

let photo = '';
let order = [];
let selected = null;
let moves = 0;
let solved = false;
let stream = null;
let openingCamera = false;

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function renderPuzzle(shufflePieces = true) {
  const size = Number($('#gridSize').value);
  const count = size * size;
  $('#gridValue').value = `${size} × ${size}`;
  $('#gridValue').textContent = `${size} × ${size}`;
  $('#total').textContent = count;
  $('#moves').textContent = '0';
  moves = 0;
  selected = null;
  solved = false;
  $('#solvedBadge').hidden = true;
  $('#puzzle').style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  if (!photo) {
    order = [];
    $('#placed').textContent = '0';
    $('#puzzle').innerHTML = '<div class="empty-puzzle">✳<small>Choose a picture<br>to begin</small></div>';
    drawStrip(false);
    return;
  }

  order = Array.from({ length: count }, (_, index) => index);
  if (shufflePieces) {
    do shuffle(order); while (order.every((piece, index) => piece === index));
  }
  $('#puzzleStatus').textContent = 'Select two pieces to swap them.';
  drawTiles();
  drawStrip(false);
}

function drawTiles() {
  const size = Number($('#gridSize').value);
  const root = $('#puzzle');
  root.replaceChildren();
  order.forEach((piece, position) => {
    const tile = document.createElement('button');
    const x = piece % size;
    const y = Math.floor(piece / size);
    tile.type = 'button';
    tile.className = 'tile';
    tile.setAttribute('aria-label', `Puzzle piece ${piece + 1}`);
    tile.style.backgroundImage = `url("${photo}")`;
    tile.style.backgroundPosition = `${(x * 100) / (size - 1)}% ${(y * 100) / (size - 1)}%`;
    tile.style.backgroundSize = `${size * 100}% ${size * 100}%`;
    if (piece === position) tile.classList.add('correct');
    if (position === selected) tile.classList.add('selected');
    tile.addEventListener('click', () => selectPiece(position));
    root.appendChild(tile);
  });
  $('#placed').textContent = order.filter((piece, index) => piece === index).length;
}

function selectPiece(position) {
  if (solved) return;
  if (selected === null) {
    selected = position;
    $('#puzzleStatus').textContent = 'Now choose another piece.';
    drawTiles();
    return;
  }
  if (selected === position) {
    selected = null;
    drawTiles();
    return;
  }
  [order[selected], order[position]] = [order[position], order[selected]];
  selected = null;
  moves += 1;
  $('#moves').textContent = moves;
  drawTiles();
  if (order.every((piece, index) => piece === index)) {
    solved = true;
    $('#puzzleStatus').textContent = 'Complete. A real moment, kept.';
    $('#solvedBadge').hidden = false;
    drawStrip(true);
  }
}

function setPhoto(source) {
  photo = source;
  $('#puzzleTitle').innerHTML = 'Your picture <span>✳</span>';
  $('#shuffleButton').disabled = false;
  $('#status').textContent = 'Picture ready. Select two pieces to swap them.';
  renderPuzzle(true);
}

function drawStrip(show) {
  const canvas = $('#stripCanvas');
  const context = canvas.getContext('2d');
  context.fillStyle = '#fbfcfa';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.fillStyle = '#263432';
  context.font = '700 24px Fraunces';
  context.fillText('photopuzzel', 180, 36);
  context.fillStyle = '#71817c';
  context.font = '11px DM Mono';
  context.fillText('A REAL MOMENT', 180, 56);
  $('#stripPlaceholder').hidden = show;
  $('#downloadButton').disabled = !show;
  $('#printButton').disabled = !show;
  if (!photo) return;
  const image = new Image();
  image.onload = () => {
    for (let index = 0; index < 3; index += 1) {
      const y = 75 + index * 158;
      context.drawImage(image, 25, y, 310, 143);
      context.strokeStyle = '#cbd9d4';
      context.strokeRect(25, y, 310, 143);
    }
    context.fillStyle = '#4d766f';
    context.font = '700 22px Fraunces';
    context.fillText(show ? '✳ solved it ✳' : 'your next adventure', 180, 570);
  };
  image.src = photo;
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  captureButton.disabled = true;
}

function waitForVideo() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
    const timeout = setTimeout(() => reject(new Error('Camera opened but no video frame arrived.')), 10000);
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

async function startCamera() {
  if (openingCamera) return;
  openingCamera = true;
  cameraError.textContent = '';
  cameraMessage.textContent = 'Requesting permission…';
  stopCamera();
  try {
    if (!window.isSecureContext) throw new Error('Camera needs HTTPS or localhost.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported in this browser.');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    await waitForVideo();
    captureButton.disabled = false;
    cameraMessage.textContent = 'Camera ready. Take your picture.';
  } catch (error) {
    stopCamera();
    const messages = {
      NotAllowedError: 'Edge blocked camera permission. Select the lock icon beside the address bar, allow Camera, then try again.',
      NotFoundError: 'No camera was found on this device.',
      NotReadableError: 'The camera is busy in another app. Close that app and retry.',
      SecurityError: 'Camera access was blocked by browser security settings.'
    };
    cameraMessage.textContent = 'Camera could not start.';
    cameraError.textContent = messages[error.name] || error.message || 'Unable to start camera.';
  } finally {
    openingCamera = false;
  }
}

function takePicture() {
  if (!stream || !video.videoWidth) {
    cameraError.textContent = 'Wait until the camera preview is visible.';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  setPhoto(canvas.toDataURL('image/jpeg', 0.92));
  closeCamera();
}

function openCamera() {
  modal.hidden = false;
  startCamera();
}

function closeCamera() {
  stopCamera();
  modal.hidden = true;
}

$('#cameraButton').addEventListener('click', openCamera);
startCameraButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', takePicture);
$('#closeCamera').addEventListener('click', closeCamera);
modal.addEventListener('click', (event) => { if (event.target === modal) closeCamera(); });
$('#imageInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setPhoto(reader.result);
  reader.readAsDataURL(file);
});
$('#gridSize').addEventListener('input', () => renderPuzzle(true));
$('#shuffleButton').addEventListener('click', () => { if (photo) renderPuzzle(true); });
$('#resetButton').addEventListener('click', () => {
  closeCamera();
  photo = '';
  $('#imageInput').value = '';
  $('#puzzleTitle').textContent = 'Waiting for a picture';
  $('#puzzleStatus').textContent = 'Choose a picture to begin.';
  $('#shuffleButton').disabled = true;
  renderPuzzle(false);
});
$('#downloadButton').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'photopuzzel-strip.png';
  link.href = $('#stripCanvas').toDataURL('image/png');
  link.click();
});
$('#printButton').addEventListener('click', () => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<img src="${$('#stripCanvas').toDataURL('image/png')}" style="max-width:100%" onload="print();close()">`);
  printWindow.document.close();
});
window.addEventListener('beforeunload', stopCamera);
renderPuzzle(false);
