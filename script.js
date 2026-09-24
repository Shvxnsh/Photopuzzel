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
const toast = $('#toast');

let stream = null;
let hands = null;
let handLoop = 0;
let starting = false;
let lastGestureCapture = 0;
let history = [];

function showError(message) {
  errorText.textContent = message;
  statusText.textContent = 'Camera needs attention';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
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
  if (!landmarks.length) {
    gestureStatus.textContent = 'Show one hand, then pinch thumb + index';
    return;
  }
  gestureStatus.textContent = isPinch(landmarks[0]) ? 'Pinch detected — capturing…' : 'Pinch thumb + index to capture';
  if (isPinch(landmarks[0]) && Date.now() - lastGestureCapture > 1800) {
    lastGestureCapture = Date.now();
    capturePhoto();
  }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function isPinch(points) { return points && points[4] && points[8] && distance(points[4], points[8]) < 0.065; }

async function startHandTracking() {
  if (!window.Hands || hands) return;
  hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.65, minTrackingConfidence: 0.6 });
  hands.onResults(drawHands);
  const loop = async () => {
    if (!stream || !hands) return;
    if (video.readyState >= 2) {
      try { await hands.send({ image: video }); } catch (error) { /* keep camera usable */ }
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
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
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

function capturePhoto() {
  if (!stream || !video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  addToHistory(canvas.toDataURL('image/jpeg', 0.9));
}

function addToHistory(source) {
  history.unshift({ source, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  history = history.slice(0, 30);
  localStorage.setItem('photopuzzel-history', JSON.stringify(history));
  renderHistory();
  showToast('Photo captured');
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
  if (handLoop) cancelAnimationFrame(handLoop);
  if (hands) { hands.close(); hands = null; }
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  captureButton.disabled = true;
}

startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', () => { lastGestureCapture = Date.now(); capturePhoto(); });
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
