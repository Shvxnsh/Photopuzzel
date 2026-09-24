const video = document.getElementById('cameraVideo');
const handCanvas = document.getElementById('handCanvas');
const handCtx = handCanvas.getContext('2d');
const captureValue = document.getElementById('captureValue');
const countdown = document.getElementById('countdown');
const gestureText = document.getElementById('gestureText');
const captureButton = document.getElementById('captureButton');
const historyList = document.getElementById('historyList');

let stream = null;
let hands = null;
let animationId = 0;
let frameStartedAt = 0;
let captureTimeout = null;
let history = [];

function d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFrameHand(points) {
  if (!points || !points[4] || !points[8]) return false;
  return d(points[4], points[8]) < 0.12;
}

function resetFrameState() {
  frameStartedAt = 0;
  countdown.hidden = true;
  countdown.textContent = '3';
  captureValue.textContent = '3';
}

function updateStatus(text) {
  gestureText.textContent = text;
}

function drawHands(results) {
  const landmarks = results.multiHandLandmarks || [];
  handCanvas.width = video.videoWidth || 640;
  handCanvas.height = video.videoHeight || 480;
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  landmarks.forEach((points) => {
    if (window.drawConnectors) {
      window.drawConnectors(handCtx, points, window.HAND_CONNECTIONS, { color: '#d9bd72', lineWidth: 3 });
    }
    if (window.drawLandmarks) {
      window.drawLandmarks(handCtx, points, { color: '#f4ead8', lineWidth: 1.4, radius: 3 });
    }
  });

  const frameReady = landmarks.length >= 2 && landmarks.slice(0, 2).every(isFrameHand);

  if (!frameReady) {
    resetFrameState();
    if (landmarks.length === 0) {
      updateStatus('pinch hands manos • conjugar y capturar (3s)');
    } else if (landmarks.length === 1) {
      updateStatus('una mano detectada • usa ambas manos para enmarcar');
    } else {
      updateStatus('pinch en ambas manos para hacer el marco');
    }
    return;
  }

  if (!frameStartedAt) {
    frameStartedAt = performance.now();
  }

  const elapsed = performance.now() - frameStartedAt;
  const remaining = Math.max(0, 3 - Math.ceil(elapsed / 1000));
  const value = remaining || 0;
  countdown.hidden = false;
  countdown.textContent = String(value);
  captureValue.textContent = String(value);
  updateStatus(`marco listo • capturando en ${value}s`);

  if (elapsed >= 3000) {
    capturePhoto();
    resetFrameState();
  }
}

async function startHands() {
  if (!window.Hands || hands) return;
  hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  hands.onResults(drawHands);

  const loop = async () => {
    if (!stream || !hands || !video || video.readyState < 2) {
      animationId = requestAnimationFrame(loop);
      return;
    }

    try {
      await hands.send({ image: video });
    } catch (error) {
      // keep camera running; ignore repeated tracking issues
    }

    animationId = requestAnimationFrame(loop);
  };

  animationId = requestAnimationFrame(loop);
}

async function startCamera() {
  if (!window.isSecureContext) {
    alert('Open this website on HTTPS or localhost for camera access.');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('This browser does not support camera access.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = stream;
    await video.play();
    await startHands();
    updateStatus('pinch hands manos • conjugar y capturar (3s)');
  } catch (error) {
    updateStatus('camera blocked • allow access in Edge');
    console.error(error);
  }
}

function addToHistory(dataUrl) {
  const item = {
    src: dataUrl,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  history.unshift(item);
  history = history.slice(0, 10);
  localStorage.setItem('photopuzzel-history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<p class="empty-state">Tus recuerdos aparecerán aquí.</p>';
    return;
  }

  history.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'history-item';
    card.innerHTML = `
      <img src="${entry.src}" alt="Photo ${index + 1}">
      <div>
        <strong>Foto ${index + 1}</strong>
        <small>${entry.time}</small>
      </div>
      <button type="button" aria-label="Download photo">↓</button>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = entry.src;
      a.download = `photopuzzel-${Date.now()}.jpg`;
      a.click();
    });

    historyList.appendChild(card);
  });
}

function capturePhoto() {
  if (!stream || !video.videoWidth || !video.videoHeight) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  ctx.filter = 'sepia(0.32) saturate(0.75) contrast(1.12) brightness(0.94)';
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';

  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 30, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(24,16,12,0.25)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  addToHistory(canvas.toDataURL('image/jpeg', 0.92));
}

captureButton.addEventListener('click', () => {
  capturePhoto();
  resetFrameState();
});

window.addEventListener('beforeunload', () => {
  if (hands) hands.close();
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (animationId) cancelAnimationFrame(animationId);
});

try {
  const saved = JSON.parse(localStorage.getItem('photopuzzel-history') || '[]');
  history = Array.isArray(saved) ? saved : [];
} catch (error) {
  history = [];
}
renderHistory();
startCamera();
