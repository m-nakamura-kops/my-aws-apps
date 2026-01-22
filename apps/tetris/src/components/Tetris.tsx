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

// テトリミノを回転（時計回り90度）
const rotate = (piece: number[][], direction: number): number[][] => {
  // direction > 0 の場合は時計回り90度回転
  const rows = piece.length;
  const cols = piece[0].length;
  const rotated: number[][] = [];
  
  // 転置して各行を反転（時計回り90度回転）
  for (let x = 0; x < cols; x++) {
    rotated[x] = [];
    for (let y = rows - 1; y >= 0; y--) {
      rotated[x].push(piece[y][x]);
    }
  }
  
  return rotated;
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
  const positionRef = useRef(position);
  const rotationRef = useRef(rotation);
  const boardRef = useRef(board);
  const currentTetrominoRef = useRef(currentTetromino);

  // refを最新の値に同期
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    currentTetrominoRef.current = currentTetromino;
  }, [currentTetromino]);

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
    const currentPos = positionRef.current;
    const currentRot = rotationRef.current;
    const currentBoard = boardRef.current;
    const currentPiece = currentTetrominoRef.current;

    if (!currentPiece || gameOver || isPaused) return;

    const newPosition = { ...currentPos, y: currentPos.y + 1 };
    if (isValidMove(currentBoard, currentPiece, newPosition, currentRot)) {
      setPosition(newPosition);
    } else {
      // テトリミノを固定
      const newBoard = placeTetromino(currentBoard, currentPiece, currentPos, currentRot);
      const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);
      setBoard(clearedBoard);

      if (linesCleared > 0) {
        setLines((prevLines) => {
          const newLines = prevLines + linesCleared;
          const newLevel = Math.floor(newLines / 10) + 1;
          setLevel(newLevel);
          // スコアも同時に更新（レベル計算に基づく）
          setScore((prevScore) => {
            const currentLevel = Math.floor(prevLines / 10) + 1;
            const newScore = prevScore + linesCleared * 100 * currentLevel;
            // ハイスコアを更新
            setHighScore((prevHighScore) => {
              if (newScore > prevHighScore) {
                localStorage.setItem('tetris-high-score', newScore.toString());
                return newScore;
              }
              return prevHighScore;
            });
            return newScore;
          });
          return newLines;
        });
      }

      startNewTetromino();
    }
  }, [gameOver, isPaused, startNewTetromino]);

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

  // ハードドロップ（一気に底まで落とす）
  const hardDrop = () => {
    if (!currentTetromino || gameOver || isPaused) return;

    const currentPos = positionRef.current;
    const currentRot = rotationRef.current;
    const currentBoard = boardRef.current;
    const currentPiece = currentTetrominoRef.current;

    // 底まで落ちる位置を計算
    let dropY = currentPos.y;
    while (isValidMove(currentBoard, currentPiece, { x: currentPos.x, y: dropY + 1 }, currentRot)) {
      dropY++;
    }

    // スコアを追加（落とした距離 × 2）
    const dropDistance = dropY - currentPos.y;
    if (dropDistance > 0) {
      setScore((prev) => prev + dropDistance * 2);
      
      // 位置を設定して即座に固定
      const finalPosition = { x: currentPos.x, y: dropY };
      const newBoard = placeTetromino(currentBoard, currentPiece, finalPosition, currentRot);
      const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);
      setBoard(clearedBoard);
      setPosition(finalPosition);

      if (linesCleared > 0) {
        setLines((prevLines) => {
          const newLines = prevLines + linesCleared;
          const newLevel = Math.floor(newLines / 10) + 1;
          setLevel(newLevel);
          // スコアも同時に更新（レベル計算に基づく）
          setScore((prevScore) => {
            const currentLevel = Math.floor(prevLines / 10) + 1;
            const newScore = prevScore + linesCleared * 100 * currentLevel;
            // ハイスコアを更新
            setHighScore((prevHighScore) => {
              if (newScore > prevHighScore) {
                localStorage.setItem('tetris-high-score', newScore.toString());
                return newScore;
              }
              return prevHighScore;
            });
            return newScore;
          });
          return newLines;
        });
      }

      startNewTetromino();
    } else {
      // 既に底にいる場合は通常のdrop処理
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
    <div className="flex flex-col items-center justify-center h-screen bg-black text-cyan-400 p-2 overflow-hidden">
      <div className="w-full max-w-md h-full flex flex-col justify-between">
        {/* スコア表示（コンパクト） */}
        <div className="flex justify-between items-center mb-1 text-xs sm:text-sm flex-shrink-0">
          <div className="flex flex-col">
            <div className="text-cyan-300">スコア: <span className="text-yellow-400 font-bold">{score}</span></div>
            <div className="text-cyan-300">ハイ: <span className="text-yellow-400 font-bold">{highScore}</span></div>
          </div>
          <div className="flex flex-col text-right">
            <div className="text-cyan-300">Lv: <span className="text-yellow-400 font-bold">{level}</span></div>
            <div className="text-cyan-300">線: <span className="text-yellow-400 font-bold">{lines}</span></div>
          </div>
          {/* 次のピース表示（右上に配置） */}
          <div className="flex flex-col items-center">
            <div className="text-cyan-300 text-xs mb-1">次</div>
            <div className="bg-gray-900 p-1 rounded border border-cyan-500">
              {nextTetromino && (
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${TETROMINOS[nextTetromino].shape[0].length}, 1fr)` }}>
                  {TETROMINOS[nextTetromino].shape.map((row, y) =>
                    row.map((cell, x) => (
                      <div
                        key={`next-${y}-${x}`}
                        className="w-2 h-2 sm:w-3 sm:h-3"
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
        </div>

        {/* ゲームボードエリア（中央に配置） */}
        <div className="flex-1 flex flex-col justify-center items-center min-h-0 mb-2">
          {/* ゲームオーバーメッセージ */}
          {gameOver && (
            <div className="text-center mb-2 flex-shrink-0">
              <div className="text-xl sm:text-2xl font-bold text-yellow-400 mb-1 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]">
                ゲームオーバー
              </div>
              <button
                onClick={resetGame}
                className="px-4 py-2 text-sm bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 active:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(0,255,255,0.6)]"
              >
                新しいゲーム
              </button>
            </div>
          )}

          {/* ゲームボード（サイズ調整） */}
          <div 
            className={`bg-gray-900 p-1 rounded-lg border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.5)] w-full tetris-board ${!gameOver ? 'cursor-pointer' : ''}`}
            style={{ maxHeight: '100%', maxWidth: '100%', aspectRatio: '10/20' }}
            onClick={() => {
              if (!gameOver) {
                togglePause();
              }
            }}
            onTouchStart={(e) => {
              if (!gameOver) {
                e.preventDefault();
                togglePause();
              }
            }}
          >
            <div className="grid gap-0 w-full h-full" style={{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`, gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)` }}>
              {displayBoard.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className="border border-gray-800"
                    style={{
                      backgroundColor: cell === 0 ? '#000000' : (cell as string),
                      boxShadow: cell !== 0 ? `0_0_10px_${cell}` : 'none',
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* スマホ操作用ボタン（コンパクト） */}
        <div className="space-y-1.5 flex-shrink-0 pb-1">
          {/* 回転ボタン */}
          <div className="flex justify-center">
            <button
              onClick={rotateTetromino}
              disabled={gameOver || isPaused}
              className="w-full h-11 sm:h-12 bg-purple-500 text-white font-bold text-sm sm:text-base rounded-lg hover:bg-purple-400 active:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(160,0,240,0.8)] touch-manipulation"
            >
              🔄 回転
            </button>
          </div>

          {/* 左右ボタン */}
          <div className="flex justify-between gap-2">
            <button
              onClick={() => moveTetromino('left')}
              disabled={gameOver || isPaused}
              className="flex-1 h-12 sm:h-14 bg-blue-500 text-white font-bold text-sm sm:text-base rounded-lg hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,0,255,0.8)] touch-manipulation"
            >
              ← 左
            </button>
            <button
              onClick={() => moveTetromino('right')}
              disabled={gameOver || isPaused}
              className="flex-1 h-12 sm:h-14 bg-blue-500 text-white font-bold text-sm sm:text-base rounded-lg hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,0,255,0.8)] touch-manipulation"
            >
              右 →
            </button>
          </div>

          {/* 下ボタン（ハードドロップ） */}
          <div className="flex justify-center">
            <button
              onClick={hardDrop}
              disabled={gameOver || isPaused}
              className="w-full h-12 sm:h-14 bg-green-500 text-white font-bold text-sm sm:text-base rounded-lg hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,255,0,0.8)] touch-manipulation"
            >
              ⬇ 一気に下
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
