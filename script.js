const $ = (selector) => document.querySelector(selector);

const video = $('#cameraVideo');
const handCanvas = $('#handCanvas');
const handContext = handCanvas.getContext('2d');
const startButton = $('#startButton');
const captureButton = $('#captureButton');
const fileInput = $('#fileInput');
const help = $('#help');
const errorText = $('#error');
const historyList = $('#historyList');
const statusText = $('#cameraStatus');
const gestureStatus = $('#gestureStatus');
const countdown = $('#countdown');
const toast = $('#toast');

let stream = null;
let hands = null;
let handLoop = 0;
let starting = false;
let history = [];
let frameStartedAt = 0;
let captureLockedUntil = 0;
let countdownTimer = 0;

function showError(message) {
  errorText.textContent = message;
  statusText.textContent = 'Camera needs attention';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// A frame is made when both hands form a thumb/index pinch. This is stable,
// easy to understand, and avoids taking photos from a single accidental hand.
function isFrameHand(points) {
  if (!points || !points[4] || !points[8]) return false;
  return distance(points[4], points[8]) < 0.12;
}

function drawHands(results) {
  const landmarks = results.multiHandLandmarks || [];
  handCanvas.width = video.videoWidth || 640;
  handCanvas.height = video.videoHeight || 480;
  handContext.clearRect(0, 0, handCanvas.width, handCanvas.height);

  landmarks.forEach((points) => {
    if (window.drawConnectors) window.drawConnectors(handContext, points, window.HAND_CONNECTIONS, { color: '#b8e5d4', lineWidth: 4 });
    if (window.drawLandmarks) window.drawLandmarks(handContext, points, { color: '#fff', lineWidth: 1, radius: 4 });
  });

  const frameReady = landmarks.length >= 2 && landmarks.slice(0, 2).every(isFrameHand);
  if (!frameReady) {
    frameStartedAt = 0;
    countdown.hidden = true;
    clearInterval(countdownTimer);
    if (landmarks.length < 2) gestureStatus.textContent = 'Show both hands and pinch thumb + index';
    else gestureStatus.textContent = 'Pinch thumb + index on both hands';
    return;
  }

  if (Date.now() < captureLockedUntil) return;
  if (!frameStartedAt) frameStartedAt = Date.now();

  const elapsed = Date.now() - frameStartedAt;
  const remaining = Math.max(0, 3 - Math.floor(elapsed / 1000));
  countdown.hidden = false;
  countdown.textContent = remaining || '📸';
  gestureStatus.textContent = `Frame held — photo in ${remaining || 0}`;

  if (elapsed >= 2800) {
    captureLockedUntil = Date.now() + 1800;
    frameStartedAt = 0;
    countdown.hidden = true;
    capturePhoto();
  }
}

async function startHandTracking() {
  if (!window.Hands || hands) return;
  hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.65, minTrackingConfidence: 0.6 });
  hands.onResults(drawHands);

  const loop = async () => {
    if (!stream || !hands) return;
    if (video.readyState >= 2) {
      try { await hands.send({ image: video }); } catch (error) { /* camera remains usable */ }
    }
    handLoop = requestAnimationFrame(loop);
  };
  handLoop = requestAnimationFrame(loop);
}

async function startCamera() {
  if (starting || stream) return;
  starting = true;
  errorText.textContent = '';
  statusText.textContent = 'Requesting permission…';

  try {
    if (!window.isSecureContext) throw new Error('Open this website over HTTPS. Camera access is blocked on plain HTTP.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This Edge browser does not support camera access.');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    help.hidden = true;
    captureButton.disabled = false;
    statusText.textContent = 'Camera ready';
    startButton.textContent = 'Camera ready';
    await startHandTracking();
  } catch (error) {
    stream = null;
    const messages = {
      NotAllowedError: 'Edge blocked permission. Select the lock icon in the address bar, allow Camera, then reload.',
      NotFoundError: 'No camera was found on this device.',
      NotReadableError: 'Camera is being used by another app. Close it and try again.'
    };
    showError(messages[error.name] || error.message || 'Could not start the camera.');
  } finally {
    starting = false;
  }
}

function applyVintageLook(context, width, height) {
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = 'rgba(191, 143, 82, 0.10)';
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.75);
  vignette.addColorStop(0, 'rgba(255, 240, 205, 0)');
  vignette.addColorStop(1, 'rgba(35, 22, 10, 0.38)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.06;
  for (let i = 0; i < width * height / 180; i += 1) {
    context.fillStyle = Math.random() > 0.5 ? '#fff4d4' : '#24160d';
    context.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
  context.restore();
}

function capturePhoto() {
  if (!stream || !video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.filter = 'sepia(0.32) saturate(0.78) contrast(1.12) brightness(0.96)';
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.filter = 'none';
  applyVintageLook(context, canvas.width, canvas.height);
  addToHistory(canvas.toDataURL('image/jpeg', 0.9));
}

function addToHistory(source) {
  history.unshift({ source, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  history = history.slice(0, 30);
  localStorage.setItem('photopuzzel-history', JSON.stringify(history));
  renderHistory();
  showToast('Vintage photo captured');
}

function renderHistory() {
  historyList.replaceChildren();
  if (!history.length) {
    historyList.innerHTML = '<p class="empty-history">Photos you capture will appear here.</p>';
    return;
  }
  history.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'history-item';
    card.innerHTML = `<img src="${item.source}" alt="Captured photo ${index + 1}"><div><span>Moment ${history.length - index}</span><small>${item.time}</small></div><button type="button" aria-label="Download photo">↓</button>`;
    card.querySelector('button').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `photopuzzel-${history.length - index}.jpg`;
      link.href = item.source;
      link.click();
    });
    historyList.appendChild(card);
  });
}

function stopCamera() {
  cancelAnimationFrame(handLoop);
  clearInterval(countdownTimer);
  if (hands) { hands.close(); hands = null; }
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  captureButton.disabled = true;
}

startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', () => { captureLockedUntil = Date.now() + 1800; capturePhoto(); });
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => addToHistory(reader.result);
  reader.readAsDataURL(file);
});
$('#clearButton').addEventListener('click', () => {
  history = [];
  localStorage.removeItem('photopuzzel-history');
  renderHistory();
});
window.addEventListener('beforeunload', stopCamera);
try { history = JSON.parse(localStorage.getItem('photopuzzel-history') || '[]'); } catch (error) { history = []; }
renderHistory();
