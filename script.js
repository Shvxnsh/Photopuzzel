const $ = (selector) => document.querySelector(selector);
const puzzle = $('#puzzle');
const gridSize = $('#gridSize');
const video = $('#cameraVideo');
const modal = $('#cameraModal');
const handCanvas = $('#handCanvas');
const handCtx = handCanvas.getContext('2d');
const capture = $('#takePhoto');
const note = $('#cameraNote');
const gestureText = $('#gestureText');
const gestureHint = $('#gestureHint');
const gestureIcon = $('#gestureIcon');

let imageSrc = null;
let tiles = [];
let selected = null;
let moves = 0;
let solved = false;
let stream = null;
let hands = null;
let raf = 0;
let gestureOn = true;
let gestureSince = 0;
let countTimer = 0;
let counting = false;

function shuffle(a) { for (let i = a.length - 1; i; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function setMessage(text, isError = false) { gestureText.textContent = text; gestureIcon.textContent = isError ? '!' : '◎'; note.textContent = isError ? text : ''; }
function renderPuzzle(shuffleIt = true) {
  const n = Number(gridSize.value); const total = n * n;
  $('#gridValue').textContent = `${n} × ${n}`; $('#totalCount').textContent = total; $('#moveCount').textContent = '0'; $('#winBadge').hidden = true; moves = 0; selected = null; solved = false; puzzle.style.gridTemplateColumns = `repeat(${n},1fr)`;
  if (!imageSrc) { tiles = []; $('#placedCount').textContent = '0'; puzzle.innerHTML = '<div class="empty-puzzle"><div><span>◎</span>Take a picture<br>to begin</div></div>'; drawStrip(false); return; }
  tiles = Array.from({length: total}, (_, i) => i); if (shuffleIt) do shuffle(tiles); while (tiles.every((x, i) => x === i));
  $('#statusText').textContent = 'Click two pieces to swap them.'; drawTiles(); drawStrip(false);
}
function drawTiles() {
  const n = Number(gridSize.value); puzzle.replaceChildren();
  tiles.forEach((piece, position) => { const button = document.createElement('button'); const x = piece % n; const y = Math.floor(piece / n); button.type = 'button'; button.className = `tile${piece === position ? ' correct' : ''}${position === selected ? ' selected' : ''}`; button.dataset.number = piece + 1; button.setAttribute('aria-label', `Piece ${piece + 1}`); button.style.backgroundImage = `url("${imageSrc}")`; button.style.backgroundPosition = `${x * 100 / (n - 1)}% ${y * 100 / (n - 1)}%`; button.onclick = () => choose(position); puzzle.appendChild(button); });
  $('#placedCount').textContent = tiles.filter((piece, i) => piece === i).length;
}
function choose(position) { if (solved) return; if (selected === null) { selected = position; $('#statusText').textContent = 'Choose another piece to swap.'; drawTiles(); return; } if (selected === position) { selected = null; drawTiles(); return; } [tiles[selected], tiles[position]] = [tiles[position], tiles[selected]]; selected = null; moves++; $('#moveCount').textContent = moves; drawTiles(); if (tiles.every((piece, i) => piece === i)) { solved = true; $('#statusText').textContent = 'Complete. A real moment, kept.'; $('#winBadge').hidden = false; drawStrip(true); } }
function setImage(src) { imageSrc = src; $('#puzzleTitle').innerHTML = 'Your picture <span>✳</span>'; renderPuzzle(true); }
function drawStrip(show) { const c = $('#stripCanvas'), ctx = c.getContext('2d'); ctx.fillStyle = '#f8fbf9'; ctx.fillRect(0, 0, c.width, c.height); ctx.textAlign = 'center'; ctx.fillStyle = '#263432'; ctx.font = '500 24px Fraunces'; ctx.fillText('photopuzzel', 180, 34); ctx.fillStyle = '#71817c'; ctx.font = '11px DM Mono'; ctx.fillText('A REAL MOMENT / 2024', 180, 54); $('#stripPlaceholder').hidden = show; $('#downloadButton').disabled = !show; $('#printButton').disabled = !show; if (!imageSrc) return; const img = new Image(); img.onload = () => { for (let i = 0; i < 3; i++) { const y = 72 + i * 160; ctx.drawImage(img, 25, y, 310, 145); ctx.strokeStyle = '#cbd9d4'; ctx.strokeRect(25, y, 310, 145); } ctx.fillStyle = '#4d766f'; ctx.font = '24px Fraunces'; ctx.fillText(show ? '✳ solved it ✳' : 'your next adventure', 180, 570); }; img.src = imageSrc; }

function stopCamera() { cancelAnimationFrame(raf); raf = 0; if (hands) { hands.close().catch(() => {}); hands = null; } if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.pause(); video.srcObject = null; handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height); clearTimeout(countTimer); counting = false; gestureSince = 0; capture.disabled = true; }
async function getCamera() {
  if (!window.isSecureContext) throw new Error('Open the HTTPS Vercel URL, not an HTTP preview.');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera access is unavailable in this browser.');
  const options = [{video: {width: {ideal: 1280}, height: {ideal: 720}, facingMode: {ideal: 'user'}}, audio: false}, {video: true, audio: false}]; let last;
  for (const constraints of options) { try { return await navigator.mediaDevices.getUserMedia(constraints); } catch (e) { last = e; if (e.name === 'NotAllowedError' || e.name === 'SecurityError') break; } } throw last;
}
function waitForVideo() { return new Promise((resolve, reject) => { if (video.videoWidth > 0) return resolve(); const timeout = setTimeout(() => reject(new Error('Camera opened but returned no video frames.')), 12000); video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, {once:true}); }); }
function handFrame(results) { const found = results.multiHandLandmarks || []; handCanvas.width = video.videoWidth || 640; handCanvas.height = video.videoHeight || 480; handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height); if (found.length >= 2) { gestureIcon.textContent = '✳'; gestureText.textContent = gestureOn ? 'Both hands detected — hold still.' : 'Both hands detected.'; gestureHint.textContent = gestureOn ? 'The photo will capture automatically.' : 'Press capture now.'; if (!gestureSince) gestureSince = performance.now(); if (gestureOn && performance.now() - gestureSince > 900 && !counting) countdown(); } else { gestureSince = 0; if (!counting) { gestureIcon.textContent = '◎'; gestureText.textContent = found.length ? 'One hand detected.' : 'Show both hands.'; gestureHint.textContent = 'Bring both hands into the camera frame.'; } } }
async function processHands() { if (!hands || video.readyState < 2) return; try { await hands.send({image: video}); } catch (e) { /* camera still works manually if hand tracking fails */ } }
function countdown() { counting = true; let value = 3; const el = $('#countdown'); el.hidden = false; el.textContent = value; countTimer = setInterval(() => { value--; if (!value) { clearInterval(countTimer); el.hidden = true; capturePhoto(); } else el.textContent = value; }, 700); }
function capturePhoto() { if (!video.videoWidth) { setMessage('The camera has no video frame yet. Wait a moment and try again.', true); counting = false; return; } const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); setImage(canvas.toDataURL('image/jpeg', .92)); closeCamera(); }

$('#cameraButton').onclick = async () => { modal.hidden = false; setMessage('Requesting camera permission…'); capture.disabled = true; try { stream = await getCamera(); video.srcObject = stream; video.muted = true; await video.play(); await waitForVideo(); capture.disabled = false; setMessage('Camera ready. Show both hands or capture now.'); if (window.Hands) { hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`}); hands.setOptions({maxNumHands: 2, minDetectionConfidence: .6, minTrackingConfidence: .6}); hands.onResults(handFrame); const loop = async () => { if (!stream) return; await processHands(); raf = requestAnimationFrame(loop); }; loop(); } } catch (e) { setMessage(e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it from the lock icon, then reload.' : (e.message || 'Could not open camera.'), true); } };
$('#takePhoto').onclick = capturePhoto;
$('#gestureToggle').onclick = () => { gestureOn = !gestureOn; $('#gestureToggle').textContent = `gesture capture: ${gestureOn ? 'on' : 'off'}`; };
function closeCamera() { stopCamera(); modal.hidden = true; }
$('#closeCamera').onclick = closeCamera; modal.onclick = e => { if (e.target === modal) closeCamera(); };
$('#gridSize').oninput = () => renderPuzzle(true); $('#shuffleButton').onclick = () => { if (imageSrc) renderPuzzle(true); }; $('#resetAll').onclick = () => { closeCamera(); imageSrc = null; $('#puzzleTitle').textContent = 'Waiting for a picture'; $('#statusText').textContent = 'Open the camera to begin.'; renderPuzzle(false); };
$('#downloadButton').onclick = () => { const a = document.createElement('a'); a.download = 'photopuzzel-strip.png'; a.href = $('#stripCanvas').toDataURL('image/png'); a.click(); }; $('#printButton').onclick = () => { const w = open('', '_blank'); if (w) { w.document.write(`<img src="${$('#stripCanvas').toDataURL('image/png')}" onload="print();close()">`); w.document.close(); } };
window.addEventListener('beforeunload', stopCamera); renderPuzzle(false);
