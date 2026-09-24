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

// Build sample images without putting raw double quotes inside a CSS url().
const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const samples = [
  svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#d5b4a5"/><stop offset=".5" stop-color="#6d7772"/><stop offset="1" stop-color="#e6c99a"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/><circle cx="450" cy="390" r="190" fill="#f0c5a5"/><path d="M245 390c20-240 390-250 420 15-120-75-280-110-420-15Z" fill="#3c3030"/><path d="M160 900c20-210 150-300 290-300s270 90 290 300" fill="#4a6562"/><circle cx="380" cy="400" r="10"/><circle cx="520" cy="400" r="10"/><path d="M400 500q50 35 100 0" fill="none" stroke="#221f1d" stroke-width="10"/></svg>`),
  svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="#e8b363"/><circle cx="450" cy="360" r="210" fill="#c46e55"/><path d="M0 720Q220 520 450 720T900 720V900H0Z" fill="#516f69"/><circle cx="450" cy="370" r="120" fill="#f4d0ad"/><path d="M320 300q130-190 260 0" fill="none" stroke="#3d3434" stroke-width="85"/></svg>`),
  svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="#8da39d"/><circle cx="600" cy="300" r="230" fill="#e8bda5"/><path d="M350 900q20-250 250-300 230 60 300 300" fill="#d47d59"/><path d="M420 340q190-220 390 10" stroke="#342f32" stroke-width="80" fill="none"/><circle cx="560" cy="350" r="12"/><circle cx="680" cy="360" r="12"/></svg>`)
];

let imageSrc = samples[0];
let selected = null;
let tiles = [];
let moves = 0;
let solved = false;
let stream = null;

function cssImageUrl(src) {
  // Escaping is required for the quotation marks in data:image/svg+xml URLs.
  return `url("${src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderPuzzle(shouldShuffle = true) {
  const size = Number(gridSizeInput.value);
  const total = size * size;
  tiles = Array.from({ length: total }, (_, index) => index);
  if (shouldShuffle) {
    do shuffle(tiles); while (tiles.every((piece, index) => piece === index));
  }
  selected = null;
  moves = 0;
  solved = false;
  winBadge.hidden = true;
  puzzle.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  puzzle.style.setProperty('--bg-size', `${size * 100}% ${size * 100}%`);
  totalCount.textContent = total;
  moveCount.textContent = moves;
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
    tile.dataset.number = piece + 1;
    tile.type = 'button';
    tile.setAttribute('aria-label', `Piece ${piece + 1}`);
    tile.style.backgroundImage = cssImageUrl(imageSrc);
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
    statusText.textContent = 'Now choose the piece to swap.';
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
    statusText.textContent = 'Beautiful. Your memory is complete.';
    winBadge.hidden = false;
    drawStrip(true);
  }
}

function setImage(src, label = 'Studio sample') {
  imageSrc = src;
  $('#puzzleTitle').innerHTML = `${label} <span>✳</span>`;
  renderPuzzle(true);
}

function drawStrip(show) {
  const context = stripCanvas.getContext('2d');
  const width = stripCanvas.width;
  context.fillStyle = '#fffaf3';
  context.fillRect(0, 0, width, stripCanvas.height);
  context.textAlign = 'center';
  context.fillStyle = '#211f1c';
  context.font = '500 24px Fraunces';
  context.fillText('photopuzzel', width / 2, 34);
  context.fillStyle = '#8b8074';
  context.font = '11px DM Mono';
  context.fillText('A LITTLE MOMENT / 2024', width / 2, 54);

  const image = new Image();
  image.onload = () => {
    for (let index = 0; index < 3; index += 1) {
      const y = 72 + index * 160;
      context.drawImage(image, 25, y, 310, 145);
      context.strokeStyle = '#d9cfc1';
      context.strokeRect(25, y, 310, 145);
    }
    context.fillStyle = '#ff6848';
    context.font = '24px Fraunces';
    context.fillText(show ? '✳ solved it ✳' : 'your next adventure', width / 2, 570);
    context.fillStyle = '#8b8074';
    context.font = '10px DM Mono';
    context.fillText('KEEP THIS ONE', width / 2, 602);
  };
  image.onerror = () => { statusText.textContent = 'This image could not be loaded.'; };
  image.src = imageSrc;
  placeholder.hidden = show;
  downloadButton.disabled = !show;
  printButton.disabled = !show;
}

imageInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setImage(reader.result, file.name.replace(/\.[^.]+$/, ''));
  reader.onerror = () => { statusText.textContent = 'The selected image could not be read.'; };
  reader.readAsDataURL(file);
});

$('.sample-row').addEventListener('click', (event) => {
  const button = event.target.closest('.sample');
  if (!button) return;
  document.querySelectorAll('.sample').forEach((item) => item.classList.toggle('active', item === button));
  setImage(samples[Number(button.dataset.sample)]);
});

gridSizeInput.addEventListener('input', () => {
  gridValue.textContent = `${gridSizeInput.value} × ${gridSizeInput.value}`;
  renderPuzzle(true);
});
$('#shuffleButton').addEventListener('click', () => renderPuzzle(true));
$('#resetAll').addEventListener('click', () => {
  imageInput.value = '';
  document.querySelectorAll('.sample').forEach((item, index) => { item.classList.toggle('active', index === 0); });
  setImage(samples[0]);
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

const modal = $('#cameraModal');
$('#cameraButton').addEventListener('click', async () => {
  modal.hidden = false;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS or localhost.');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    $('#cameraVideo').srcObject = stream;
  } catch (error) {
    $('#cameraNote').textContent = `${error.message} You can still upload a picture.`;
  }
});
function closeCamera() {
  modal.hidden = true;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
}
$('#closeCamera').addEventListener('click', closeCamera);
$('#takePhoto').addEventListener('click', () => {
  const video = $('#cameraVideo');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  setImage(canvas.toDataURL('image/jpeg', 0.9), 'Camera memory');
  closeCamera();
});

renderPuzzle(true);
