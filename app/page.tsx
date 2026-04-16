'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Constants
const COLS = 10;
const ROWS = 20;
const WIN_LINES = 3;

interface Tetromino {
  shape: number[][];
  color: string;
  type: string;
}

const TETROMINOS: Record<string, { shape: number[][]; color: string }> = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#00f0f0' },
  O: { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#a000f0' },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#00f000' },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#f00000' },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#0000f0' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f0a000' },
};

const getRandomTetromino = (): Tetromino => {
  const keys = Object.keys(TETROMINOS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return { ...TETROMINOS[key], type: key };
};

type Board = (string | null)[][];

export default function TetrisGame() {
  // Application State
  const [screen, setScreen] = useState<'lobby' | 'game' | 'gameover' | 'fail'>('lobby');
  const [userName, setUserName] = useState('');
  
  // Game State
  const [board, setBoard] = useState<Board>(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
  const [currentPiece, setCurrentPiece] = useState<{ pos: { x: number; y: number }; shape: number[][]; color: string } | null>(null);
  const [nextPiece, setNextPiece] = useState<Tetromino>(getRandomTetromino());
  const [linesCleared, setLinesCleared] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [finalTime, setFinalTime] = useState('');
  const [rankings, setRankings] = useState<{name: string, finishtime: string}[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Game
  const startGame = () => {
    if (!userName.trim()) return alert('이름을 입력해주세요!');
    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
    setLinesCleared(0);
    setSeconds(0);
    setScreen('game');
    setIsPaused(false);
    spawnPieceInitial();
  };

  const spawnPieceInitial = () => {
    const piece = getRandomTetromino();
    const next = getRandomTetromino();
    setNextPiece(next);
    const pos = { x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), y: 0 };
    setCurrentPiece({ pos, shape: piece.shape, color: piece.color });
  };

  const spawnPiece = useCallback(() => {
    const piece = nextPiece;
    const newNext = getRandomTetromino();
    setNextPiece(newNext);

    const pos = { x: Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2), y: 0 };
    
    // Check game over on spawn
    if (checkCollision(pos, piece.shape, board)) {
      setFinalTime(formatTime(seconds));
      setScreen('fail');
      return;
    }
    
    setCurrentPiece({ pos, shape: piece.shape, color: piece.color });
  }, [nextPiece, board, seconds]);

  const checkCollision = (pos: { x: number; y: number }, shape: number[][], currentBoard: Board) => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (
            newX < 0 || 
            newX >= COLS || 
            newY >= ROWS || 
            (newY >= 0 && currentBoard[newY][newX] !== null)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const lockPiece = useCallback(() => {
    if (!currentPiece) return;
    
    let newBoard = board.map(row => [...row]);
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = currentPiece.pos.y + y;
          const boardX = currentPiece.pos.x + x;
          if (boardY >= 0 && boardY < ROWS) {
            newBoard[boardY][boardX] = currentPiece.color;
          }
        }
      });
    });
    
    // Clear lines
    let clearedInThisStep = 0;
    const filteredBoard = newBoard.filter(row => {
      const isFull = row.every(cell => cell !== null);
      if (isFull) clearedInThisStep++;
      return !isFull;
    });
    
    while (filteredBoard.length < ROWS) {
      filteredBoard.unshift(Array(COLS).fill(null));
    }
    
    const totalCleared = linesCleared + clearedInThisStep;
    setLinesCleared(totalCleared);
    setBoard(filteredBoard);
    setCurrentPiece(null);

    if (totalCleared >= WIN_LINES) {
      const timeStr = formatTime(seconds);
      setFinalTime(timeStr);
      setScreen('gameover');
      saveGameResult(userName, timeStr);
    } else {
      setTimeout(() => spawnPiece(), 0);
    }
  }, [currentPiece, board, linesCleared, seconds, spawnPiece, userName]);

  const saveGameResult = async (name: string, finishtime: string) => {
    const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) return;

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // CORS 정책 우회 (Google Apps Script 특성상 no-cors가 안정적일 수 있음)
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, finishtime }),
      });
      console.log('Record saved successfully');
      fetchRankings(); // 결과 저장 후 랭킹 새로고침
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  const fetchRankings = useCallback(async () => {
    try {
      const response = await fetch('/api/rankings');
      const data = await response.json();
      if (Array.isArray(data)) {
        setRankings(data);
      }
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || isPaused || screen !== 'game') return;
    
    const newPos = { x: currentPiece.pos.x + dx, y: currentPiece.pos.y + dy };
    if (!checkCollision(newPos, currentPiece.shape, board)) {
      setCurrentPiece(prev => prev ? { ...prev, pos: newPos } : null);
    } else if (dy > 0) {
      lockPiece();
    }
  }, [currentPiece, board, isPaused, screen, lockPiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || isPaused || screen !== 'game') return;
    
    const rotated = currentPiece.shape[0].map((_, index) =>
      currentPiece.shape.map(col => col[index]).reverse()
    );
    
    if (!checkCollision(currentPiece.pos, rotated, board)) {
      setCurrentPiece(prev => prev ? { ...prev, shape: rotated } : null);
    }
  }, [currentPiece, board, isPaused, screen]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || isPaused || screen !== 'game') return;
    
    let currentY = currentPiece.pos.y;
    while (!checkCollision({ x: currentPiece.pos.x, y: currentY + 1 }, currentPiece.shape, board)) {
      currentY++;
    }
    
    // Update local variable instead of state to avoid sync issues with lockPiece
    const finalPos = { ...currentPiece.pos, y: currentY };
    
    // We need to lock it immediately with the new position
    let newBoard = board.map(row => [...row]);
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = finalPos.y + y;
          const boardX = finalPos.x + x;
          if (boardY >= 0 && boardY < ROWS) {
            newBoard[boardY][boardX] = currentPiece.color;
          }
        }
      });
    });

    let clearedInThisStep = 0;
    const filteredBoard = newBoard.filter(row => {
      const isFull = row.every(cell => cell !== null);
      if (isFull) clearedInThisStep++;
      return !isFull;
    });
    while (filteredBoard.length < ROWS) {
      filteredBoard.unshift(Array(COLS).fill(null));
    }

    const totalCleared = linesCleared + clearedInThisStep;
    setLinesCleared(totalCleared);
    setBoard(filteredBoard);
    setCurrentPiece(null);

    if (totalCleared >= WIN_LINES) {
      const timeStr = formatTime(seconds);
      setFinalTime(timeStr);
      setScreen('gameover');
      saveGameResult(userName, timeStr);
    } else {
      spawnPiece();
    }
  }, [currentPiece, board, linesCleared, seconds, spawnPiece, userName]);

  // Timer Effect
  useEffect(() => {
    if (screen === 'game' && !isPaused) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, isPaused]);

  // Game Loop Effect
  useEffect(() => {
    if (screen === 'game' && !isPaused) {
      gameLoopRef.current = setInterval(() => {
        movePiece(0, 1);
      }, 800);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [screen, isPaused, movePiece]);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'game' || isPaused) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); break;
        case 'ArrowUp': rotatePiece(); break;
        case ' ': hardDrop(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, isPaused, movePiece, rotatePiece, hardDrop]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetToLobby = () => {
    setScreen('lobby');
    setUserName('');
  };

  const ControlGuide = ({ style = {} }: { style?: React.CSSProperties }) => (
    <div className="glass-panel" style={{ padding: '24px', width: '220px', ...style }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Controls</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[
          { key: '← →', action: 'Move' },
          { key: '↑', action: 'Rotate' },
          { key: '↓', action: 'Soft Drop' },
          { key: 'Space', action: 'Hard Drop' },
        ].map((item) => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              border: '1px solid var(--border)',
              minWidth: '60px',
              textAlign: 'center'
            }}>{item.key}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.action}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const RankingBoard = () => (
    <div className="glass-panel" style={{ padding: '24px', width: '220px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Top 3 Rankings</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rankings.length > 0 ? (
          rankings.map((rank, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : '#cd7f32', fontWeight: 'bold', fontSize: '1.1rem', minWidth: '20px' }}>{i + 1}</span>
              <span style={{ fontSize: '0.9rem', color: 'white', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rank.name}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '600', fontFamily: 'monospace' }}>{rank.finishtime}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>기록이 없습니다.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="main-wrapper">
      {screen === 'lobby' && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div className="glass-panel lobby-content animate-fade-in" style={{ padding: '40px', textAlign: 'center', minWidth: '400px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TETRIS</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', letterSpacing: '1px' }}>3줄 제거 도전!</p>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', textAlign: 'left', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>사용자 이름</label>
              <input 
                type="text" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)}
                placeholder="이름을 입력하세요"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', height: '54px', fontSize: '1.1rem' }} onClick={startGame}>
              게임 시작
            </button>
            
            <footer style={{ 
              marginTop: '40px', 
              paddingTop: '20px', 
              borderTop: '1px solid var(--border)', 
              fontSize: '0.85rem', 
              color: 'var(--text-muted)', 
              lineHeight: '1.8' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span>과목명: <strong>AI코딩</strong></span>
                <span>학과: <strong>물리학과</strong></span>
                <span>이름: <strong>김기태</strong></span>
              </div>
            </footer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <RankingBoard />
            <ControlGuide />
          </div>
        </div>
      )}

      {screen === 'game' && (
        <div className="tetris-container animate-fade-in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="game-board" style={{ position: 'relative' }}>
              {board.map((row, y) => (
                row.map((cell, x) => {
                  let color = cell;
                  let isGhost = false;
                  
                  // Draw current piece
                  if (currentPiece) {
                    const pieceY = y - currentPiece.pos.y;
                    const pieceX = x - currentPiece.pos.x;
                    if (pieceY >= 0 && pieceY < currentPiece.shape.length && pieceX >= 0 && pieceX < currentPiece.shape[0].length) {
                      if (currentPiece.shape[pieceY][pieceX] !== 0) {
                        color = currentPiece.color;
                      }
                    }
                  }
                  
                  return (
                    <div 
                      key={`${y}-${x}`} 
                      className={`cell ${color ? 'filled' : ''}`} 
                      style={{ 
                        backgroundColor: color || 'transparent',
                        boxShadow: color ? `inset 0 0 10px rgba(0,0,0,0.5), 0 0 5px ${color}44` : 'none',
                        border: color ? `1px solid rgba(255,255,255,0.2)` : '1px solid rgba(255,255,255,0.03)'
                      }}
                    />
                  );
                })
              ))}
              
              {isPaused && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  zIndex: 10
                }}>
                  <h2 style={{ color: 'white', letterSpacing: '4px' }}>PAUSED</h2>
                </div>
              )}
            </div>
          </div>
          
          <div className="side-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '20px', width: '220px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>NEXT</p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(4, 25px)`, 
                gridTemplateRows: `repeat(4, 25px)`,
                gap: '1px',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.2)',
                padding: '10px',
                borderRadius: '8px'
              }}>
                {Array.from({ length: 4 }).map((_, y) => 
                  Array.from({ length: 4 }).map((_, x) => {
                    let filled = false;
                    const shape = nextPiece.shape;
                    if (y < shape.length && x < shape[0].length && shape[y][x] !== 0) {
                      filled = true;
                    }
                    return (
                      <div 
                        key={`next-${y}-${x}`} 
                        style={{ 
                          width: '25px', 
                          height: '25px', 
                          background: filled ? nextPiece.color : 'transparent',
                          borderRadius: '2px',
                          boxShadow: filled ? `inset 0 0 8px rgba(0,0,0,0.3)` : 'none'
                        }} 
                      />
                    );
                  })
                )}
              </div>
            </div>

            <RankingBoard />
            <ControlGuide />

            <div className="glass-panel" style={{ padding: '24px', width: '220px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>PLAYER</p>
                <h3 style={{ fontSize: '1.1rem', color: 'white' }}>{userName}</h3>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>TIME</p>
                <h3 style={{ fontSize: '1.8rem', fontFamily: 'monospace', color: '#6366f1' }}>{formatTime(seconds)}</h3>
              </div>
              
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>LINES</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <h3 style={{ fontSize: '1.8rem' }}>{linesCleared}</h3>
                  <span style={{ color: 'var(--text-muted)' }}>/ {WIN_LINES}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${(linesCleared / WIN_LINES) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setIsPaused(!isPaused)}>
                  {isPaused ? '계속하기' : '일시정지'}
                </button>
                <button className="btn btn-danger" onClick={() => setScreen('lobby')}>
                  게임종료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(screen === 'gameover' || screen === 'fail') && (
        <div className="glass-panel animate-fade-in" style={{ padding: '40px', textAlign: 'center', minWidth: '420px', border: screen === 'gameover' ? '2px solid var(--primary)' : '2px solid #ef4444' }}>
          <div style={{ fontSize: '4rem', marginBottom: '10px' }}>{screen === 'gameover' ? '🏆' : '👾'}</div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', color: screen === 'gameover' ? 'var(--primary)' : '#ef4444' }}>
            {screen === 'gameover' ? 'MISSION CLEAR!' : 'GAME OVER'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            {screen === 'gameover' ? `${linesCleared}줄 제거를 성공하셨습니다!` : '블록이 가득 찼습니다.'}
          </p>
          
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', background: screen === 'gameover' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{screen === 'gameover' ? '기록된 완료 시간' : '진행 시간'}</p>
            <h2 style={{ fontSize: '3.5rem', margin: '8px 0', fontFamily: 'monospace' }}>{finalTime}</h2>
            <p style={{ fontWeight: '600' }}>
              {screen === 'gameover' ? '수고하셨습니다, ' : '다시 도전해보세요, '}
              <span style={{ color: screen === 'gameover' ? 'var(--primary)' : '#ef4444' }}>{userName}</span>님!
            </p>
          </div>
          
          <button className="btn btn-primary" style={{ width: '100%', height: '54px', fontSize: '1.1rem', background: screen === 'gameover' ? 'var(--primary)' : '#ef4444' }} onClick={resetToLobby}>
            다시 시작하기
          </button>
        </div>
      )}

      <style jsx>{`
        .main-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%);
        }
        .lobby-content {
          box-shadow: 0 0 50px rgba(99, 102, 241, 0.15);
        }
      `}</style>
    </div>
  );
}
