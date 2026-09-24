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
const handCanvas = $('#handCanvas');
const handCtx = handCanvas.getContext('2d');
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
let stream = null;
let hands = null;
let animationFrameId = 0;
let gestureOn = true;
let gestureReadySince = 0;
let captureTimer = null;
let captureCount = 0;
let manualMode = false;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
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
    do {
      shuffle(tiles);
    } while (tiles.every((piece, index) => piece === index));
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
    for (let i = 0; i < 3; i++) {
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

function stopCamera() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }

  if (hands) {
    try {
      hands.close();
    } catch (error) {
      // ignore close errors
    }
    hands = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  gestureReadySince = 0;
  captureCount = 0;
  countdownEl.hidden = true;
  counting = false;
  takePhotoButton.disabled = true;
}

function setCameraStatus(message, isError = false) {
  gestureText.textContent = message;
  gestureIcon.textContent = isError ? '!' : '◎';
  if (isError) {
    cameraNote.textContent = message;
  } else {
    cameraNote.textContent = '';
  }
}

async function openCamera() {
  if (!window.isSecureContext) {
    throw new Error('Use the HTTPS Vercel URL. This will not work on a plain HTTP page.');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser does not support camera access.');
  }

  const attempts = [
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: true, audio: false }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempt);
    } catch (error) {
      lastError = error;
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        break;
      }
    }
  }

  throw lastError || new Error('No camera was available.');
}

function waitForVideoReady() {
  return new Promise((resolve, reject) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Camera started but no video frames were returned.'));
    }, 10000);

    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFrameGesture(landmarks) {
  if (!landmarks || landmarks.length < 2) return false;

  const handA = landmarks[0];
  const handB = landmarks[1];
  if (!handA || !handB) return false;

  const aThumbIndex = distance(handA[4], handA[8]);
  const aOpenPalm = distance(handA[8], handA[5]) > 0.07 && distance(handA[12], handA[9]) > 0.08;
  const bThumbIndex = distance(handB[4], handB[8]);
  const bOpenPalm = distance(handB[8], handB[5]) > 0.07 && distance(handB[12], handB[9]) > 0.08;

  return (aThumbIndex < 0.11 || aOpenPalm) && (bThumbIndex < 0.11 || bOpenPalm);
}

function startCountdown() {
  if (captureTimer) clearInterval(captureTimer);

  captureCount = 3;
  countdownEl.hidden = false;
  countdownEl.textContent = String(captureCount);

  captureTimer = setInterval(() => {
    captureCount -= 1;
    if (captureCount <= 0) {
      clearInterval(captureTimer);
      countdownEl.hidden = true;
      captureCurrentFrame();
      return;
    }
    countdownEl.textContent = String(captureCount);
  }, 800);
}

function handsFrame(results) {
  const found = results.multiHandLandmarks || [];

  handCanvas.width = video.videoWidth || 640;
  handCanvas.height = video.videoHeight || 480;
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  if (found.length >= 2) {
    found.slice(0, 2).forEach((landmarks) => {
      if (window.drawConnectors) {
        window.drawConnectors(handCtx, landmarks, window.HAND_CONNECTIONS, { color: '#d9bd72', lineWidth: 3 });
      }
      if (window.drawLandmarks) {
        window.drawLandmarks(handCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 3 });
      }
    });
  }

  if (!gestureOn) {
    if (captureTimer) {
      clearInterval(captureTimer);
      captureTimer = null;
      countdownEl.hidden = true;
    }
    gestureText.textContent = 'Gesture capture off';
    gestureHint.textContent = 'Use Capture now to take the photo.';
    return;
  }

  if (found.length >= 2 && isFrameGesture(found)) {
    if (!gestureReadySince) gestureReadySince = performance.now();

    if (performance.now() - gestureReadySince > 700) {
      if (!captureTimer) {
        gestureText.textContent = 'Both hands detected';
        gestureHint.textContent = 'Holding the frame…';
        startCountdown();
      }
    }
  } else {
    gestureReadySince = 0;
    if (!captureTimer) {
      gestureText.textContent = found.length === 1 ? 'One hand detected' : 'Show both hands';
      gestureHint.textContent = 'Bring both hands into the camera frame.';
      gestureIcon.textContent = '◎';
    }
  }
}

async function initHands() {
  if (!window.Hands) return;

  hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  hands.onResults(handsFrame);

  const loop = async () => {
    if (!stream || !hands || !video || video.readyState < 2) {
      animationFrameId = requestAnimationFrame(loop);
      return;
    }

    try {
      await hands.send({ image: video });
    } catch (error) {
      // ignore repeated tracking failures; manual capture works as fallback
    }

    animationFrameId = requestAnimationFrame(loop);
  };

  animationFrameId = requestAnimationFrame(loop);
}

function captureCurrentFrame() {
  if (!video.videoWidth || !video.videoHeight) {
    setCameraStatus('Camera is still starting. Try again in a moment.', true);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  setImage(canvas.toDataURL('image/jpeg', 0.92));
  closeCamera();
}

async function openCameraModal() {
  modal.hidden = false;
  setCameraStatus('Requesting camera permission…');
  takePhotoButton.disabled = true;

  try {
    stream = await openCamera();
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await waitForVideoReady();

    setCameraStatus('Camera ready. Show both hands or capture now.');
    takePhotoButton.disabled = false;
    await initHands();
  } catch (error) {
    const name = error && error.name;
    if (name === 'NotAllowedError') {
      setCameraStatus('Camera permission was blocked. Allow camera access in your browser, then reload.', true);
    } else if (name === 'NotFoundError') {
      setCameraStatus('No camera was found on this laptop.', true);
    } else if (name === 'NotReadableError') {
      setCameraStatus('The camera is already in use by another app.', true);
    } else {
      setCameraStatus(error && error.message ? error.message : 'Unable to start camera.', true);
    }
  }
}

function closeCamera() {
  stopCamera();
  modal.hidden = true;
}

$('#cameraButton').addEventListener('click', openCameraModal);
takePhotoButton.addEventListener('click', captureCurrentFrame);
$('#gestureToggle').addEventListener('click', () => {
  gestureOn = !gestureOn;
  $('#gestureToggle').textContent = `gesture capture: ${gestureOn ? 'on' : 'off'}`;
  if (!gestureOn && captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
    countdownEl.hidden = true;
  }
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
