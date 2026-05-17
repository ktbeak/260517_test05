const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30; // 30px * 10 = 300, 30px * 20 = 600

// Neon colors with their glowing variants
const COLORS = [
    null,
    '#00ffff', // I - Cyan
    '#0000ff', // J - Blue
    '#ffa500', // L - Orange
    '#ffff00', // O - Yellow
    '#00ff00', // S - Green
    '#800080', // T - Purple
    '#ff0000'  // Z - Red
];

// Tetromino shapes matrix
const SHAPES = [
    [],
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    [
        [4, 4],
        [4, 4]
    ],
    [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
];

let board = [];
let piece;
let nextPiece;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let score = 0;
let level = 1;
let lines = 0;
let gamePaused = false;
let gameOver = false;
let animationId;

// Initialize empty board
function createBoard() {
    return Array.from({length: ROWS}, () => Array(COLS).fill(0));
}

// Generate random piece
function randomPiece() {
    const typeId = Math.floor(Math.random() * 7) + 1;
    return {
        matrix: SHAPES[typeId],
        pos: {x: Math.floor(COLS / 2) - Math.floor(SHAPES[typeId][0].length / 2), y: 0},
        typeId: typeId
    };
}

// Draw a single block with neon effect
function drawBlock(context, x, y, typeId, isGhost = false) {
    if (typeId === 0) return;
    
    const color = COLORS[typeId];
    context.fillStyle = color;
    
    if (isGhost) {
        context.globalAlpha = 0.2;
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        context.globalAlpha = 1.0;
    } else {
        // Core
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        
        // Inner shadow / highlight for 3D/Glass look
        context.fillStyle = 'rgba(255,255,255,0.3)';
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, 4);
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 4, BLOCK_SIZE);
        
        context.fillStyle = 'rgba(0,0,0,0.3)';
        context.fillRect(x * BLOCK_SIZE + BLOCK_SIZE - 4, y * BLOCK_SIZE, 4, BLOCK_SIZE);
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE + BLOCK_SIZE - 4, BLOCK_SIZE, 4);
        
        // Neon Glow
        context.shadowBlur = 10;
        context.shadowColor = color;
        context.strokeStyle = 'rgba(255,255,255,0.5)';
        context.lineWidth = 1;
        context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        context.shadowBlur = 0; // Reset
    }
}

function drawMatrix(matrix, offset, context, isGhost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(context, x + offset.x, y + offset.y, value, isGhost);
            }
        });
    });
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let r = 0; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(canvas.width, r * BLOCK_SIZE);
        ctx.stroke();
    }
    for(let c = 0; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawMatrix(board, {x: 0, y: 0}, ctx);
    
    // Draw Ghost
    const ghostPos = getGhostPos();
    drawMatrix(piece.matrix, ghostPos, ctx, true);
    
    // Draw Piece
    drawMatrix(piece.matrix, piece.pos, ctx);
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const m = nextPiece.matrix;
    
    // Calculate bounding box of the piece to center it properly
    let minX = m[0].length, maxX = 0, minY = m.length, maxY = 0;
    m.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        });
    });
    
    const pieceWidth = maxX - minX + 1;
    const pieceHeight = maxY - minY + 1;
    
    // Center offset based on actual shape dimensions
    const offsetX = (4 - pieceWidth) / 2 - minX;
    const offsetY = (4 - pieceHeight) / 2 - minY;

    nextCtx.save();
    nextCtx.scale(0.8, 0.8);
    // Adjusted translation to center the 120x120 canvas (which is 150x150 in unscaled coordinates)
    drawMatrix(m, {x: offsetX + 0.5, y: offsetY + 0.5}, nextCtx);
    nextCtx.restore();
}

function getGhostPos() {
    const ghostPos = {x: piece.pos.x, y: piece.pos.y};
    while (!collide(board, {matrix: piece.matrix, pos: ghostPos})) {
        ghostPos.y++;
    }
    ghostPos.y--;
    return ghostPos;
}

function collide(board, piece) {
    const m = piece.matrix;
    const o = piece.pos;
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, piece) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + piece.pos.y][x + piece.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    // Transpose
    const rotated = matrix[0].map((val, index) => matrix.map(row => row[index]));
    // Reverse rows
    if (dir > 0) return rotated.map(row => row.reverse());
    return rotated.reverse();
}

function playerRotate(dir) {
    const pos = piece.pos.x;
    let offset = 1;
    piece.matrix = rotate(piece.matrix, dir);
    while (collide(board, piece)) {
        piece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > piece.matrix[0].length) {
            // Revert rotation if it can't be placed
            piece.matrix = rotate(piece.matrix, -dir);
            piece.pos.x = pos;
            return;
        }
    }
}

function playerMove(dir) {
    piece.pos.x += dir;
    if (collide(board, piece)) {
        piece.pos.x -= dir;
    }
}

function playerDrop() {
    piece.pos.y++;
    if (collide(board, piece)) {
        piece.pos.y--;
        merge(board, piece);
        resetPiece();
        clearLines();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, piece)) {
        piece.pos.y++;
    }
    piece.pos.y--;
    merge(board, piece);
    resetPiece();
    clearLines();
    dropCounter = 0;
}

function resetPiece() {
    piece = nextPiece;
    nextPiece = randomPiece();
    drawNextPiece();
    
    // Check Game Over
    if (collide(board, piece)) {
        gameOver = true;
        gameOverScreen.classList.remove('hidden');
    }
}

function clearLines() {
    let linesCleared = 0;
    outer: for (let y = board.length - 1; y >= 0; y--) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] === 0) continue outer;
        }
        
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        y++;
        linesCleared++;
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        const lineScores = [0, 40, 100, 300, 1200]; // 1, 2, 3, 4 lines
        score += lineScores[linesCleared] * level;
        
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        updateScore();
        
        // Add visual flash effect to canvas container
        canvas.parentElement.classList.add('flash-effect');
        setTimeout(() => canvas.parentElement.classList.remove('flash-effect'), 200);
    }
}

function updateScore() {
    scoreElement.innerText = score;
    levelElement.innerText = level;
    linesElement.innerText = lines;
}

function update(time = 0) {
    if (gamePaused || gameOver) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    
    draw();
    animationId = requestAnimationFrame(update);
}

function togglePause() {
    if (gameOver) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        cancelAnimationFrame(animationId);
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        lastTime = performance.now();
        update(lastTime);
    }
}

function resetGame() {
    board = createBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    gameOver = false;
    gamePaused = false;
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    updateScore();
    
    nextPiece = randomPiece();
    resetPiece(); // This will pull from nextPiece and generate a new nextPiece
    
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    update(lastTime);
}

// Keyboard Controls
document.addEventListener('keydown', event => {
    // Prevent default scrolling for arrows and space
    if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }

    if (gameOver) return;
    
    switch(event.keyCode) {
        case 37: // Left
            if(!gamePaused) playerMove(-1);
            break;
        case 39: // Right
            if(!gamePaused) playerMove(1);
            break;
        case 40: // Down
            if(!gamePaused) playerDrop();
            break;
        case 38: // Up (Rotate)
            if(!gamePaused) playerRotate(1);
            break;
        case 32: // Space (Hard Drop)
            if(!gamePaused) playerHardDrop();
            break;
        case 80: // P (Pause)
            togglePause();
            break;
    }
});

restartBtn.addEventListener('click', () => {
    resetGame();
    // Remove focus from button so spacebar doesn't trigger it again
    restartBtn.blur();
});

resumeBtn.addEventListener('click', () => {
    togglePause();
    resumeBtn.blur();
});

// Initialize first piece and start game
nextPiece = randomPiece();
resetGame();
