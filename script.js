const $ = (s) => document.querySelector(s);
const video = $('#video');
const modal = $('#modal');
const capture = $('#capture');
const cameraMessage = $('#cameraMessage');
const cameraError = $('#cameraError');
let image = null;
let pieces = [];
let selected = null;
let moveCount = 0;
let stream = null;
let opening = false;
let solved = false;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function setStatus(text, error = false) { cameraMessage.textContent = text; cameraError.textContent = error ? text : ''; }
function renderPuzzle(shuffleIt = true) {
  const n = +$('#size').value; const total = n * n;
  $('#sizeValue').textContent = `${n} × ${n}`; $('#total').textContent = total; $('#moves').textContent = '0'; moveCount = 0; selected = null; solved = false; $('#win').hidden = true;
  if (!image) { pieces = []; $('#placed').textContent = '0'; $('#puzzle').innerHTML = '<div class="empty">◎<br><small>Take a picture<br>to begin</small></div>'; drawStrip(false); return; }
  pieces = Array.from({ length: total }, (_, i) => i); if (shuffleIt) { do shuffle(pieces); while (pieces.every((v, i) => v === i)); }
  $('#puzzleStatus').textContent = 'Click two pieces to swap them.'; drawTiles(); drawStrip(false);
}
function drawTiles() {
  const n = +$('#size').value; const root = $('#puzzle'); root.replaceChildren(); root.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  pieces.forEach((piece, position) => { const tile = document.createElement('button'); const x = piece % n; const y = Math.floor(piece / n); tile.className = 'tile'; tile.type = 'button'; tile.style.backgroundImage = `url("${image}")`; tile.style.backgroundPosition = `${x * 100 / (n - 1)}% ${y * 100 / (n - 1)}%`; if (piece === position) tile.classList.add('correct'); if (position === selected) tile.classList.add('selected'); tile.onclick = () => choose(position); root.appendChild(tile); });
  $('#placed').textContent = pieces.filter((p, i) => p === i).length;
}
function choose(position) { if (solved) return; if (selected === null) { selected = position; drawTiles(); return; } if (selected === position) { selected = null; drawTiles(); return; } [pieces[selected], pieces[position]] = [pieces[position], pieces[selected]]; selected = null; moveCount++; $('#moves').textContent = moveCount; drawTiles(); if (pieces.every((p, i) => p === i)) { solved = true; $('#puzzleStatus').textContent = 'Complete. A real moment, kept.'; $('#win').hidden = false; drawStrip(true); } }
function useImage(src) { image = src; $('#title').innerHTML = 'Your picture <span>✳</span>'; renderPuzzle(true); }
function drawStrip(show) { const c = $('#stripCanvas'), ctx = c.getContext('2d'); ctx.fillStyle = '#f8fbf9'; ctx.fillRect(0, 0, c.width, c.height); ctx.textAlign = 'center'; ctx.fillStyle = '#263432'; ctx.font = '24px Fraunces'; ctx.fillText('photopuzzel', 180, 34); $('#placeholder').hidden = show; $('#download').disabled = !show; $('#print').disabled = !show; if (!image) return; const pic = new Image(); pic.onload = () => { for (let i = 0; i < 3; i++) ctx.drawImage(pic, 25, 72 + i * 160, 310, 145); ctx.fillStyle = '#4d766f'; ctx.font = '22px Fraunces'; ctx.fillText(show ? '✳ solved it ✳' : 'your next adventure', 180, 570); }; pic.src = image; }
function stopCamera() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; video.pause(); video.srcObject = null; capture.disabled = true; }
function waitForVideo() { return new Promise((resolve, reject) => { if (video.videoWidth) return resolve(); const timer = setTimeout(() => reject(new Error('Camera opened but returned no video.')), 10000); const ready = () => { clearTimeout(timer); resolve(); }; video.addEventListener('loadedmetadata', ready, { once: true }); video.addEventListener('canplay', ready, { once: true }); }); }
async function startCamera() { if (opening) return; opening = true; modal.hidden = false; stopCamera(); setStatus('Requesting camera permission…'); try { if (!window.isSecureContext) throw new Error('Camera requires HTTPS or localhost.'); if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access.'); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); video.srcObject = stream; await waitForVideo(); await video.play(); capture.disabled = false; setStatus('Camera ready. Press capture now.'); } catch (e) { stopCamera(); const messages = { NotAllowedError: 'Permission denied. Allow camera access in the browser, then press retry.', NotFoundError: 'No camera was found.', NotReadableError: 'Camera is busy in another app.' }; setStatus(messages[e.name] || e.message || 'Unable to start camera.', true); } finally { opening = false; } }
function takePhoto() { if (!stream || !video.videoWidth) return setStatus('Camera is not ready yet. Press retry.', true); const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); useImage(canvas.toDataURL('image/jpeg', .92)); closeCamera(); }
function closeCamera() { stopCamera(); modal.hidden = true; }
$('#openCamera').onclick = startCamera; $('#retry').onclick = startCamera; $('#capture').onclick = takePhoto; $('#close').onclick = closeCamera; modal.onclick = (e) => { if (e.target === modal) closeCamera(); }; $('#fileInput').onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => useImage(reader.result); reader.readAsDataURL(file); }; $('#size').oninput = () => renderPuzzle(true); $('#shuffle').onclick = () => image && renderPuzzle(true); $('#reset').onclick = () => { closeCamera(); image = null; $('#title').textContent = 'Waiting for a picture'; $('#puzzleStatus').textContent = 'Open the camera to begin.'; renderPuzzle(false); }; $('#download').onclick = () => { const a = document.createElement('a'); a.download = 'photopuzzel-strip.png'; a.href = $('#stripCanvas').toDataURL(); a.click(); }; $('#print').onclick = () => { const w = window.open(); if (w) { w.document.write(`<img src="${$('#stripCanvas').toDataURL()}" onload="print();close()">`); w.document.close(); } }; window.addEventListener('beforeunload', stopCamera); renderPuzzle(false);
