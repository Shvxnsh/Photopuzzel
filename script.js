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
const handCanvas = $('#handCanvas');
const handContext = handCanvas.getContext('2d');
const takePhotoButton = $('#takePhoto');
const countdown = $('#countdown');
const gestureText = $('#gestureText');
const gestureHint = $('#gestureHint');
const gestureIcon = $('#gestureIcon');

let imageSrc = null;
let selected = null;
let tiles = [];
let moves = 0;
let solved = false;
let stream = null;
let hands = null;
let cameraLoop = null;
let gestureCapture = true;
let bothHandsSince = 0;
let countdownTimer = null;
let capturing = false;

function shuffle(array) { for (let i = array.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function renderPuzzle(shouldShuffle = true) {
  const size = Number(gridSizeInput.value); const total = size * size;
  totalCount.textContent = total; gridValue.textContent = `${size} × ${size}`; selected = null; moves = 0; solved = false; winBadge.hidden = true; moveCount.textContent = '0'; puzzle.style.gridTemplateColumns = `repeat(${size},1fr)`;
  if (!imageSrc) { tiles = []; placedCount.textContent = '0'; puzzle.innerHTML = '<div class="empty-puzzle"><div><span>◎</span>Take a picture<br>to begin</div></div>'; drawStrip(false); return; }
  tiles = Array.from({length: total}, (_, i) => i); if (shouldShuffle) do shuffle(tiles); while (tiles.every((piece, i) => piece === i));
  statusText.textContent = 'Click two pieces to swap them.'; drawTiles(); drawStrip(false);
}
function drawTiles() { const size = Number(gridSizeInput.value); puzzle.replaceChildren(); tiles.forEach((piece, position) => { const tile = document.createElement('button'); const x = piece % size; const y = Math.floor(piece / size); tile.className = 'tile'; tile.type = 'button'; tile.dataset.number = piece + 1; tile.setAttribute('aria-label', `Piece ${piece + 1}`); tile.style.backgroundImage = `url("${imageSrc}")`; tile.style.backgroundPosition = `${x * 100 / (size - 1)}% ${y * 100 / (size - 1)}%`; if (piece === position) tile.classList.add('correct'); if (position === selected) tile.classList.add('selected'); tile.addEventListener('click', () => chooseTile(position)); puzzle.appendChild(tile); }); placedCount.textContent = tiles.filter((piece, i) => piece === i).length; }
function chooseTile(position) { if (solved) return; if (selected === null) { selected = position; statusText.textContent = 'Choose another piece to swap.'; drawTiles(); return; } if (selected === position) { selected = null; drawTiles(); return; } [tiles[selected], tiles[position]] = [tiles[position], tiles[selected]]; selected = null; moves += 1; moveCount.textContent = moves; drawTiles(); if (tiles.every((piece, i) => piece === i)) { solved = true; statusText.textContent = 'Complete. A real moment, kept.'; winBadge.hidden = false; drawStrip(true); } }
function setImage(src) { imageSrc = src; $('#puzzleTitle').innerHTML = 'Your picture <span>✳</span>'; renderPuzzle(true); }
function drawStrip(show) { const context = stripCanvas.getContext('2d'); context.fillStyle = '#f8fbf9'; context.fillRect(0, 0, 360, 640); context.textAlign = 'center'; context.fillStyle = '#263432'; context.font = '500 24px Fraunces'; context.fillText('photopuzzel', 180, 34); context.fillStyle = '#71817c'; context.font = '11px DM Mono'; context.fillText('A REAL MOMENT / 2024', 180, 54); placeholder.hidden = show; downloadButton.disabled = !show; printButton.disabled = !show; if (!imageSrc) return; const image = new Image(); image.onload = () => { for (let i = 0; i < 3; i += 1) { const y = 72 + i * 160; context.drawImage(image, 25, y, 310, 145); context.strokeStyle = '#cbd9d4'; context.strokeRect(25, y, 310, 145); } context.fillStyle = '#4d766f'; context.font = '24px Fraunces'; context.fillText(show ? '✳ solved it ✳' : 'your next adventure', 180, 570); }; image.src = imageSrc; }

gridSizeInput.addEventListener('input', () => renderPuzzle(true));
$('#shuffleButton').addEventListener('click', () => { if (imageSrc) renderPuzzle(true); });
$('#resetAll').addEventListener('click', () => { imageSrc = null; $('#puzzleTitle').textContent = 'Waiting for a picture'; statusText.textContent = 'Open the camera to begin.'; renderPuzzle(false); });
downloadButton.addEventListener('click', () => { const link = document.createElement('a'); link.download = 'photopuzzel-strip.png'; link.href = stripCanvas.toDataURL('image/png'); link.click(); });
printButton.addEventListener('click', () => { const printWindow = window.open('', '_blank'); if (!printWindow) return; printWindow.document.write(`<img style="max-width:100%" src="${stripCanvas.toDataURL('image/png')}" onload="print();close()">`); printWindow.document.close(); });

function setCameraMessage(message, error = false) { gestureText.textContent = message; gestureHint.textContent = error ? 'Check the lock icon in your address bar, allow camera access, and try again.' : 'Then raise both hands to frame your face.'; gestureIcon.textContent = error ? '!' : '◎'; $('#cameraNote').textContent = error ? message : ''; takePhotoButton.disabled = error; }
function stopCamera() { if (cameraLoop) { cameraLoop.stop(); cameraLoop = null; } if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null; if (hands) { hands.close(); hands = null; } video.pause(); video.srcObject = null; handContext.clearRect(0, 0, handCanvas.width, handCanvas.height); bothHandsSince = 0; clearTimeout(countdownTimer); countdown.hidden = true; capturing = false; }
function waitForVideo() { return new Promise((resolve, reject) => { if (video.readyState >= 2 && video.videoWidth) return resolve(); const timeout = setTimeout(() => reject(new Error('Camera feed timed out.')), 10000); video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, {once:true}); }); }
async function openCamera() { if (!window.isSecureContext) throw new Error('This page must be opened on the HTTPS Vercel URL.'); if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access.'); const attempts = [{video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:'user'}},audio:false},{video:{width:{ideal:640},height:{ideal:480}},audio:false},{video:true,audio:false}]; let last; for (const constraints of attempts) { try { return await navigator.mediaDevices.getUserMedia(constraints); } catch (error) { last = error; if (error.name === 'NotAllowedError' || error.name === 'SecurityError') break; } } throw last || new Error('No camera was available.'); }
function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
function isFrameGesture(landmarks) { if (!landmarks || landmarks.length < 2) return false; const handsReady = landmarks.slice(0,2).every((hand) => { const pinch = distance(hand[4], hand[8]) < 0.085; const open = distance(hand[8],hand[5]) > 0.08 && distance(hand[12],hand[9]) > 0.07; return pinch || open; }); return handsReady; }
function onHands(results) { handCanvas.width = video.videoWidth || 640; handCanvas.height = video.videoHeight || 480; handContext.clearRect(0,0,handCanvas.width,handCanvas.height); const found = results.multiHandLandmarks || []; if (found.length >= 2) { found.slice(0,2).forEach((landmarks) => { if (window.drawConnectors) drawConnectors(handContext, landmarks, HAND_CONNECTIONS, {color:'#d9bd72', lineWidth:3}); if (window.drawLandmarks) drawLandmarks(handContext, landmarks, {color:'#fff', lineWidth:1, radius:3}); }); } const ready = found.length >= 2 && isFrameGesture(found); if (ready) { gestureText.textContent = gestureCapture ? 'Hold it — both hands detected.' : 'Both hands detected.'; gestureHint.textContent = gestureCapture ? 'Keep the frame steady.' : 'Use capture now when ready.'; gestureIcon.textContent = '✳'; if (!bothHandsSince) bothHandsSince = performance.now(); if (gestureCapture && performance.now() - bothHandsSince > 800 && !capturing) startCountdown(); } else { bothHandsSince = 0; if (!capturing) { gestureText.textContent = found.length === 1 ? 'One hand detected.' : 'Show both hands.'; gestureHint.textContent = 'Bring both hands into the camera frame.'; gestureIcon.textContent = '◎'; } } }
function startCountdown() { capturing = true; let value = 3; countdown.hidden = false; countdown.textContent = value; countdownTimer = setInterval(() => { value -= 1; if (value <= 0) { clearInterval(countdownTimer); countdown.hidden = true; capturePhoto(); } else countdown.textContent = value; }, 700); }
function capturePhoto() { if (!video.videoWidth || !video.videoHeight) { capturing = false; return; } const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video,0,0); setImage(canvas.toDataURL('image/jpeg',.92)); closeCamera(); }

$('#cameraButton').addEventListener('click', async () => { modal.hidden = false; setCameraMessage('Starting camera…'); takePhotoButton.disabled = true; try { stream = await openCamera(); video.srcObject = stream; video.muted = true; await video.play(); await waitForVideo(); setCameraMessage('Camera ready.'); takePhotoButton.disabled = false; if (!window.Hands || !window.Camera) throw new Error('Gesture library failed to load.'); hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`}); hands.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.65,minTrackingConfidence:.6}); hands.onResults(onHands); cameraLoop = new Camera(video,{onFrame:async () => { if (hands) await hands.send({image:video}); },width:640,height:480}); cameraLoop.start(); } catch (error) { setCameraMessage(error.message || 'Unable to start camera.', true); } });
$('#takePhoto').addEventListener('click', capturePhoto);
$('#gestureToggle').addEventListener('click', () => { gestureCapture = !gestureCapture; $('#gestureToggle').textContent = `gesture capture: ${gestureCapture ? 'on' : 'off'}`; });
function closeCamera() { stopCamera(); modal.hidden = true; }
$('#closeCamera').addEventListener('click', closeCamera);
modal.addEventListener('click', (event) => { if (event.target === modal) closeCamera(); });
window.addEventListener('beforeunload', stopCamera);
renderPuzzle(false);
