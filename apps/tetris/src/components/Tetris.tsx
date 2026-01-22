'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

// テトリミノの形状定義
const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00ffff',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#ffff00',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#a000f0',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#00ff00',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#ff0000',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#0000ff',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#ffa500',
  },
};

type TetrominoType = keyof typeof TETROMINOS;
type Cell = number | string;
type Board = Cell[][];

// 空のボードを作成
const createBoard = (): Board =>
  Array(BOARD_HEIGHT)
    .fill(null)
    .map(() => Array(BOARD_WIDTH).fill(0));

// ランダムなテトリミノを取得
const randomTetromino = (): TetrominoType => {
  const tetrominos = Object.keys(TETROMINOS) as TetrominoType[];
  return tetrominos[Math.floor(Math.random() * tetrominos.length)];
};

// テトリミノを回転
const rotate = (piece: number[][], direction: number): number[][] => {
  const rotated = piece.map((_, index) =>
    piece.map((col) => col[index])
  );
  if (direction > 0) return rotated.map((row) => row.reverse());
  return rotated.reverse();
};

// テトリミノをボードに配置できるかチェック
const isValidMove = (
  board: Board,
  tetromino: TetrominoType,
  position: { x: number; y: number },
  rotation: number = 0
): boolean => {
  const shape = TETROMINOS[tetromino].shape;
  let rotatedShape = shape;
  for (let i = 0; i < rotation; i++) {
    rotatedShape = rotate(rotatedShape, 1);
  }

  for (let y = 0; y < rotatedShape.length; y++) {
    for (let x = 0; x < rotatedShape[y].length; x++) {
      if (rotatedShape[y][x]) {
        const newX = position.x + x;
        const newY = position.y + y;

        if (
          newX < 0 ||
          newX >= BOARD_WIDTH ||
          newY >= BOARD_HEIGHT ||
          (newY >= 0 && board[newY][newX] !== 0)
        ) {
          return false;
        }
      }
    }
  }
  return true;
};

// テトリミノをボードに配置
const placeTetromino = (
  board: Board,
  tetromino: TetrominoType,
  position: { x: number; y: number },
  rotation: number = 0
): Board => {
  const newBoard = board.map((row) => [...row]);
  const shape = TETROMINOS[tetromino].shape;
  let rotatedShape = shape;
  for (let i = 0; i < rotation; i++) {
    rotatedShape = rotate(rotatedShape, 1);
  }
  const color = TETROMINOS[tetromino].color;

  for (let y = 0; y < rotatedShape.length; y++) {
    for (let x = 0; x < rotatedShape[y].length; x++) {
      if (rotatedShape[y][x] && position.y + y >= 0) {
        newBoard[position.y + y][position.x + x] = color;
      }
    }
  }
  return newBoard;
};

// 完成した行を削除
const clearLines = (board: Board): { newBoard: Board; linesCleared: number } => {
  const newBoard: Board = [];
  let linesCleared = 0;

  for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell !== 0)) {
      linesCleared++;
    } else {
      newBoard.unshift([...board[y]]);
    }
  }

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(0));
  }

  return { newBoard, linesCleared };
};

export default function Tetris() {
  const [board, setBoard] = useState<Board>(createBoard());
  const [currentTetromino, setCurrentTetromino] = useState<TetrominoType | null>(null);
  const [nextTetromino, setNextTetromino] = useState<TetrominoType>(randomTetromino());
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dropTime, setDropTime] = useState<number | null>(null);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ハイスコアを読み込み
  useEffect(() => {
    const savedHighScore = localStorage.getItem('tetris-high-score');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // 新しいテトリミノを開始
  const startNewTetromino = useCallback(() => {
    const newTetromino = nextTetromino;
    setCurrentTetromino(newTetromino);
    setNextTetromino(randomTetromino());
    setPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });
    setRotation(0);

    if (!isValidMove(board, newTetromino, { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 })) {
      setGameOver(true);
      setDropTime(null);
    }
  }, [board, nextTetromino]);

  // テトリミノをドロップ
  const drop = useCallback(() => {
    if (!currentTetromino || gameOver || isPaused) return;

    const newPosition = { ...position, y: position.y + 1 };
    if (isValidMove(board, currentTetromino, newPosition, rotation)) {
      setPosition(newPosition);
    } else {
      // テトリミノを固定
      const newBoard = placeTetromino(board, currentTetromino, position, rotation);
      const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);
      setBoard(clearedBoard);

      if (linesCleared > 0) {
        const newLines = lines + linesCleared;
        const newScore = score + linesCleared * 100 * level;
        const newLevel = Math.floor(newLines / 10) + 1;
        setLines(newLines);
        setScore(newScore);
        setLevel(newLevel);

        // ハイスコアを更新
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem('tetris-high-score', newScore.toString());
        }
      }

      startNewTetromino();
    }
  }, [board, currentTetromino, position, rotation, gameOver, isPaused, lines, score, level, highScore, startNewTetromino]);

  // ゲームループ
  useEffect(() => {
    if (gameOver || isPaused) {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = null;
      }
      return;
    }

    const speed = Math.max(100, 1000 - (level - 1) * 100);
    gameIntervalRef.current = setInterval(() => {
      drop();
    }, speed);

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, [drop, gameOver, isPaused, level]);

  // 最初のテトリミノを開始
  useEffect(() => {
    if (!currentTetromino && !gameOver) {
      startNewTetromino();
    }
  }, [currentTetromino, gameOver, startNewTetromino]);

  // 移動処理
  const moveTetromino = (direction: 'left' | 'right' | 'down') => {
    if (!currentTetromino || gameOver || isPaused) return;

    let newPosition = { ...position };
    if (direction === 'left') {
      newPosition.x -= 1;
    } else if (direction === 'right') {
      newPosition.x += 1;
    } else if (direction === 'down') {
      newPosition.y += 1;
    }

    if (isValidMove(board, currentTetromino, newPosition, rotation)) {
      setPosition(newPosition);
      if (direction === 'down') {
        setScore((prev) => prev + 1);
      }
    } else if (direction === 'down') {
      drop();
    }
  };

  // 回転処理
  const rotateTetromino = () => {
    if (!currentTetromino || gameOver || isPaused) return;

    const newRotation = (rotation + 1) % 4;
    if (isValidMove(board, currentTetromino, position, newRotation)) {
      setRotation(newRotation);
    }
  };

  // ゲームリセット
  const resetGame = () => {
    setBoard(createBoard());
    setCurrentTetromino(null);
    setNextTetromino(randomTetromino());
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
  };

  // 一時停止/再開
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // 表示用のボードを作成（現在のテトリミノを含む）
  const displayBoard = currentTetromino
    ? placeTetromino(
        board.map((row) => [...row]),
        currentTetromino,
        position,
        rotation
      )
    : board;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-cyan-400 p-4">
      <div className="w-full max-w-md">
        {/* スコア表示 */}
        <div className="flex justify-between items-center mb-4 text-lg">
          <div className="flex flex-col">
            <div className="text-cyan-300">スコア: <span className="text-yellow-400 font-bold">{score}</span></div>
            <div className="text-cyan-300">ハイスコア: <span className="text-yellow-400 font-bold">{highScore}</span></div>
          </div>
          <div className="flex flex-col text-right">
            <div className="text-cyan-300">レベル: <span className="text-yellow-400 font-bold">{level}</span></div>
            <div className="text-cyan-300">ライン: <span className="text-yellow-400 font-bold">{lines}</span></div>
          </div>
        </div>

        {/* ゲームボード */}
        <div className="bg-gray-900 p-2 rounded-lg border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.5)] mb-4">
          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)` }}>
            {displayBoard.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className="aspect-square border border-gray-800"
                  style={{
                    backgroundColor: cell === 0 ? '#000000' : (cell as string),
                    boxShadow: cell !== 0 ? `0_0_10px_${cell}` : 'none',
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* 次のテトリミノ表示 */}
        <div className="mb-4 text-center">
          <div className="text-cyan-300 mb-2">次のピース:</div>
          <div className="bg-gray-900 p-2 rounded-lg border border-cyan-500 inline-block">
            {nextTetromino && (
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${TETROMINOS[nextTetromino].shape[0].length}, 1fr)` }}>
                {TETROMINOS[nextTetromino].shape.map((row, y) =>
                  row.map((cell, x) => (
                    <div
                      key={`next-${y}-${x}`}
                      className="w-4 h-4"
                      style={{
                        backgroundColor: cell ? TETROMINOS[nextTetromino].color : 'transparent',
                        border: cell ? `1px solid ${TETROMINOS[nextTetromino].color}` : 'none',
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ゲームオーバー/一時停止メッセージ */}
        {(gameOver || isPaused) && (
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-yellow-400 mb-2 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]">
              {gameOver ? 'ゲームオーバー' : '一時停止'}
            </div>
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 active:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(0,255,255,0.6)]"
            >
              新しいゲーム
            </button>
          </div>
        )}

        {/* コントロールボタン */}
        {!gameOver && (
          <div className="mb-4 text-center">
            <button
              onClick={togglePause}
              className="px-6 py-3 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400 active:bg-purple-600 transition-all shadow-[0_0_15px_rgba(160,0,240,0.6)] mb-4"
            >
              {isPaused ? '再開' : '一時停止'}
            </button>
          </div>
        )}

        {/* スマホ操作用ボタン */}
        <div className="space-y-3">
          {/* 回転ボタン */}
          <div className="flex justify-center">
            <button
              onClick={rotateTetromino}
              disabled={gameOver || isPaused}
              className="w-32 h-16 bg-purple-500 text-white font-bold text-xl rounded-lg hover:bg-purple-400 active:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(160,0,240,0.8)] touch-manipulation"
            >
              🔄 回転
            </button>
          </div>

          {/* 左右ボタン */}
          <div className="flex justify-between gap-4">
            <button
              onClick={() => moveTetromino('left')}
              disabled={gameOver || isPaused}
              className="flex-1 h-20 bg-blue-500 text-white font-bold text-xl rounded-lg hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,0,255,0.8)] touch-manipulation"
            >
              ← 左
            </button>
            <button
              onClick={() => moveTetromino('right')}
              disabled={gameOver || isPaused}
              className="flex-1 h-20 bg-blue-500 text-white font-bold text-xl rounded-lg hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,0,255,0.8)] touch-manipulation"
            >
              右 →
            </button>
          </div>

          {/* 下ボタン */}
          <div className="flex justify-center">
            <button
              onClick={() => moveTetromino('down')}
              disabled={gameOver || isPaused}
              className="w-full h-20 bg-green-500 text-white font-bold text-xl rounded-lg hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,255,0,0.8)] touch-manipulation"
            >
              ⬇ 下
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
