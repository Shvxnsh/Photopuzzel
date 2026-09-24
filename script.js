const $ = (selector) => document.querySelector(selector);
const puzzle = $('#puzzle');
const imageInput = $('#photoInput');
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

const samples = [
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"%3E%3Cdefs%3E%3ClinearGradient id="g" x2="1" y2="1"%3E%3Cstop stop-color="%23d5b4a5"/%3E%3Cstop offset=".5" stop-color="%236d7772"/%3E%3Cstop offset="1" stop-color="%23e6c99a"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="900" height="900" fill="url(%23g)"/%3E%3Ccircle cx="450" cy="390" r="190" fill="%23f0c5a5"/%3E%3Cpath d="M245 390c20-240 390-250 420 15-120-75-280-110-420-15Z" fill="%233c3030"/%3E%3Cpath d="M160 900c20-210 150-300 290-300s270 90 290 300" fill="%234a6562"/%3E%3Ccircle cx="380" cy="400" r="10" fill="%23221f1d"/><circle cx="520" cy="400" r="10" fill="%23221f1d"/%3E%3Cpath d="M400 500q50 35 100 0" fill="none" stroke="%23221f1d" stroke-width="10"/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"%3E%3Crect width="900" height="900" fill="%23e8b363"/%3E%3Ccircle cx="450" cy="360" r="210" fill="%23c46e55"/%3E%3Cpath d="M0 720Q220 520 450 720T900 720V900H0Z" fill="%23516f69"/%3E%3Ccircle cx="450" cy="370" r="120" fill="%23f4d0ad"/%3E%3Cpath d="M320 300q130-190 260 0" fill="none" stroke="%233d3434" stroke-width="85"/%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"%3E%3Crect width="900" height="900" fill="%238da39d"/%3E%3Ccircle cx="600" cy="300" r="230" fill="%23e8bda5"/%3E%3Cpath d="M350 900q20-250 250-300 230 60 300 300" fill="%23d47d59"/%3E%3Cpath d="M420 340q190-220 390 10" stroke="%23342f32" stroke-width="80" fill="none"/%3E%3Ccircle cx="560" cy="350" r="12"/%3E%3Ccircle cx="680" cy="360" r="12"/%3E%3C/svg%3E'
];
let imageSrc = samples[0], selected = null, tiles = [], moves = 0, solved = false, stream = null;

function imageLoaded(src) { return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.src = src; }); }
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function renderPuzzle(shouldShuffle = true) {
  const n = Number(gridSizeInput.value), total = n * n;
  tiles = Array.from({ length: total }, (_, i) => i);
  if (shouldShuffle) { do { shuffle(tiles); } while (tiles.every((x, i) => x === i)); }
  moves = 0; selected = null; solved = false; winBadge.hidden = true;
  puzzle.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  puzzle.style.setProperty('--bg-size', `${n * 100}% ${n * 100}%`);
  totalCount.textContent = total; moveCount.textContent = moves; statusText.textContent = 'Click two pieces to swap them.';
  drawTiles(); drawStrip(false);
}
function drawTiles() {
  const n = Number(gridSizeInput.value);
  puzzle.innerHTML = '';
  tiles.forEach((piece, position) => {
    const tile = document.createElement('button'); tile.className = 'tile'; tile.dataset.number = piece + 1; tile.setAttribute('aria-label', `Piece ${piece + 1}`);
    const x = piece % n, y = Math.floor(piece / n);
    tile.style.backgroundImage = `url("${imageSrc}")`; tile.style.backgroundPosition = `${x * 100 / (n - 1)}% ${y * 100 / (n - 1)}%`;
    if (piece === position) tile.classList.add('correct');
    if (position === selected) tile.classList.add('selected');
    tile.addEventListener('click', () => chooseTile(position)); puzzle.appendChild(tile);
  });
  placedCount.textContent = tiles.filter((piece, i) => piece === i).length;
}
function chooseTile(position) {
  if (solved) return;
  if (selected === null) { selected = position; statusText.textContent = 'Now choose the piece to swap.'; drawTiles(); return; }
  if (selected === position) { selected = null; drawTiles(); return; }
  [tiles[selected], tiles[position]] = [tiles[position], tiles[selected]]; selected = null; moves++; moveCount.textContent = moves; drawTiles();
  if (tiles.every((piece, i) => piece === i)) { solved = true; statusText.textContent = 'Beautiful. Your memory is complete.'; winBadge.hidden = false; drawStrip(true); }
}
async function setImage(src, label = 'Studio sample') { imageSrc = src; $('#puzzleTitle').innerHTML = `${label} <span>✳</span>`; renderPuzzle(true); }
function drawStrip(show) {
  const ctx = stripCanvas.getContext('2d'), w = stripCanvas.width, h = stripCanvas.height;
  ctx.fillStyle = '#fffaf3'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#211f1c'; ctx.textAlign = 'center';
  ctx.font = '500 24px Fraunces'; ctx.fillText('photopuzzel', w / 2, 34);
  ctx.font = '11px DM Mono'; ctx.fillStyle = '#8b8074'; ctx.fillText('A LITTLE MOMENT / 2024', w / 2, 54);
  const img = new Image(); img.onload = () => { for (let i = 0; i < 3; i++) { const y = 72 + i * 160; ctx.drawImage(img, 25, y, 310, 145); ctx.strokeStyle = '#d9cfc1'; ctx.strokeRect(25, y, 310, 145); } ctx.fillStyle = '#ff6848'; ctx.font = '24px Fraunces'; ctx.fillText(show ? '✳ solved it ✳' : 'your next adventure', w / 2, 570); ctx.fillStyle = '#8b8074'; ctx.font = '10px DM Mono'; ctx.fillText('KEEP THIS ONE', w / 2, 602); }; img.src = imageSrc;
  placeholder.hidden = show; downloadButton.disabled = !show; printButton.disabled = !show;
}
imageInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = () => setImage(reader.result, file.name.split('.')[0]); reader.readAsDataURL(file); } });
$('.sample-row').addEventListener('click', (e) => { const button = e.target.closest('.sample'); if (!button) return; document.querySelectorAll('.sample').forEach((b) => b.classList.remove('active')); button.classList.add('active'); setImage(samples[button.dataset.sample]); });
gridSizeInput.addEventListener('input', () => { gridValue.textContent = `${gridSizeInput.value} × ${gridSizeInput.value}`; renderPuzzle(true); });
$('#shuffleButton').addEventListener('click', () => renderPuzzle(true));
$('#resetAll').addEventListener('click', () => { imageInput.value = ''; document.querySelectorAll('.sample').forEach((b, i) => b.classList.toggle('active', i === 0)); setImage(samples[0]); });
downloadButton.addEventListener('click', () => { const link = document.createElement('a'); link.download = 'photopuzzel-strip.png'; link.href = stripCanvas.toDataURL('image/png'); link.click(); });
printButton.addEventListener('click', () => { const win = window.open(); win.document.write(`<img style="max-width:100%" src="${stripCanvas.toDataURL('image/png')}" onload="print();close()">`); });
const modal = $('#cameraModal');
$('#cameraButton').addEventListener('click', async () => { modal.hidden = false; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); $('#cameraVideo').srcObject = stream; } catch { $('#cameraNote').textContent = 'Camera access was not available. You can still upload a picture.'; } });
function closeCamera() { modal.hidden = true; if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null; }
$('#closeCamera').addEventListener('click', closeCamera);
$('#takePhoto').addEventListener('click', () => { const video = $('#cameraVideo'), canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); setImage(canvas.toDataURL('image/jpeg', .9), 'Camera memory'); closeCamera(); });
renderPuzzle(true);
