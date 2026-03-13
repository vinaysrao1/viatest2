import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import './App.css';

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER = 1;
const AI = 2;
const AI_MAX_TIME = 2000; // Maximum AI thinking time in milliseconds

function App() {
  const [board, setBoard] = useState(() =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY))
  );
  const [currentPlayer, setCurrentPlayer] = useState(PLAYER);
  const [winner, setWinner] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);

  // Refs to track AI execution state for cleanup
  const aiCancelCallbackRef = useRef(null);
  const aiTimeoutIdRef = useRef(null);

  // Create new empty board
  const createEmptyBoard = () =>
    Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));

  // Reset game
  const resetGame = useCallback(() => {
    // Cancel any ongoing AI move
    if (aiCancelCallbackRef.current) {
      aiCancelCallbackRef.current();
      aiCancelCallbackRef.current = null;
    }
    if (aiTimeoutIdRef.current) {
      clearTimeout(aiTimeoutIdRef.current);
      aiTimeoutIdRef.current = null;
    }

    setBoard(createEmptyBoard());
    setCurrentPlayer(PLAYER);
    setWinner(null);
    setWinningCells([]);
    setIsGameOver(false);
  }, []);

  // Check if column has space
  const getAvailableRow = (boardState, col) => {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (boardState[row][col] === EMPTY) return row;
    }
    return null;
  };

  // Drop piece in column
  const dropPiece = (boardState, col, player) => {
    const newBoard = boardState.map(row => [...row]);
    const availableRow = getAvailableRow(boardState, col);
    if (availableRow !== null) {
      newBoard[availableRow][col] = player;
    }
    return { board: newBoard, row: availableRow };
  };

  // Check for win after a move
  const checkWin = (boardState, row, col, player) => {
    const directions = [
      [[0, 1], [0, -1]],   // Horizontal
      [[1, 0], [-1, 0]],   // Vertical
      [[1, 1], [-1, -1]], // Diagonal /
      [[1, -1], [-1, 1]]  // Diagonal \
    ];

    for (const [dir1, dir2] of directions) {
      let count = 1;
      let cells = [[row, col]];

      // Check first direction
      for (let i = 1; i < 4; i++) {
        const newRow = row + dir1[0] * i;
        const newCol = col + dir1[1] * i;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS &&
            boardState[newRow][newCol] === player) {
          count++;
          cells.push([newRow, newCol]);
        } else break;
      }

      // Check second direction
      for (let i = 1; i < 4; i++) {
        const newRow = row + dir2[0] * i;
        const newCol = col + dir2[1] * i;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS &&
            boardState[newRow][newCol] === player) {
          count++;
          cells.push([newRow, newCol]);
        } else break;
      }

      if (count >= 4) return cells;
    }
    return null;
  };

  // Check for draw
  const checkDraw = (boardState) => {
    return boardState[0].every(cell => cell !== EMPTY);
  };

  // Get valid columns
  const getValidColumns = (boardState) => {
    return boardState[0].map((cell, col) => cell === EMPTY ? col : -1).filter(col => col !== -1);
  };

  // Execute a move and check game end conditions
  const executeMove = useCallback((col, player) => {
    const availableRow = getAvailableRow(board, col);
    if (availableRow === null) return false;

    const newBoard = board.map(row => [...row]);
    newBoard[availableRow][col] = player;

    setBoard(newBoard);

    // Check for win
    const winningLine = checkWin(newBoard, availableRow, col, player);
    if (winningLine) {
      setWinner(player);
      setWinningCells(winningLine);
      setIsGameOver(true);
      return true;
    }

    // Check for draw
    if (checkDraw(newBoard)) {
      setWinner('draw');
      setIsGameOver(true);
      return true;
    }

    // Switch player
    setCurrentPlayer(player === PLAYER ? AI : PLAYER);
    return true;
  }, [board]);

  // AI Move - Basic Strategy with Timeout Support
  const aiMove = useCallback(() => {
    const validCols = getValidColumns(board);
    if (validCols.length === 0) return;

    // Create a cancel token for timeout
    const cancelToken = { cancelled: false };
    aiCancelCallbackRef.current = () => {
      cancelToken.cancelled = true;
    };

    let bestCol = null;
    let bestScore = -Infinity;

    // Prioritize center columns
    const centerCol = 3;
    const colPriority = [3, 2, 4, 1, 5, 0, 6];

    // Process moves with cancellation support
    for (const col of colPriority) {
      // Check for cancellation (timeout)
      if (cancelToken.cancelled) {
        // Fallback to first valid column if cancelled
        executeMove(validCols[0], AI);
        return;
      }

      if (!validCols.includes(col)) continue;

      // Simulate AI move
      const { board: newBoard, row } = dropPiece(board, col, AI);
      if (row === null) continue;

      // Check if AI wins
      const aiWin = checkWin(newBoard, row, col, AI);
      if (aiWin) {
        bestCol = col;
        break;
      }

      // Simulate player response
      let score = 0;

      // Check if player can win (block)
      for (const pCol of validCols) {
        // Check for cancellation during inner loop
        if (cancelToken.cancelled) {
          executeMove(validCols[0], AI);
          return;
        }

        const { board: pBoard, row: pRow } = dropPiece(newBoard, pCol, PLAYER);
        if (pRow !== null) {
          const playerWin = checkWin(pBoard, pRow, pCol, PLAYER);
          if (playerWin) {
            score -= 100;
          }
        }
      }

      // Prefer center columns
      score += (3 - Math.abs(col - centerCol)) * 5;

      // Lower columns have more potential
      score += (ROWS - row) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    // Check for final cancellation
    if (cancelToken.cancelled) {
      executeMove(validCols[0], AI);
      return;
    }

    if (bestCol !== null) {
      executeMove(bestCol, AI);
    }
  }, [board, executeMove]);

  // Handle column click (player move)
  const handleColumnClick = useCallback((col) => {
    if (isGameOver || currentPlayer !== PLAYER) return;
    executeMove(col, PLAYER);
  }, [isGameOver, currentPlayer, executeMove]);

  // Trigger AI move after player moves
  useEffect(() => {
    if (currentPlayer === AI && !isGameOver) {
      const delay = setTimeout(() => {
        // Set up timeout to force AI to make a move
        const timeoutId = setTimeout(() => {
          if (aiCancelCallbackRef.current) {
            aiCancelCallbackRef.current();
          }
        }, AI_MAX_TIME);
        aiTimeoutIdRef.current = timeoutId;

        // Execute AI move
        aiMove();
      }, 500);

      return () => {
        clearTimeout(delay);
        if (aiTimeoutIdRef.current) {
          clearTimeout(aiTimeoutIdRef.current);
        }
        if (aiCancelCallbackRef.current) {
          aiCancelCallbackRef.current();
        }
      };
    }
  }, [currentPlayer, isGameOver, board, aiMove]);

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8}>
          <div className="game-container">
            <h1 className="text-center mb-4 title">Connect 4</h1>

            <div className="instructions text-center">
              <p className="mb-0">
                <strong>How to play:</strong> Click any column to drop your piece (red).
                Connect 4 in a row to win!
              </p>
            </div>

            {/* Status */}
            <div className="text-center mb-3">
              {isGameOver ? (
                <div className={`status-badge ${
                  winner === PLAYER ? 'won-player' :
                  winner === AI ? 'won-ai' : 'draw'
                }`}>
                  {winner === PLAYER ? '🎉 You Win!' :
                   winner === AI ? '🤖 AI Wins!' : '🤝 Draw Game!'}
                </div>
              ) : (
                <div className={`status-badge ${
                  currentPlayer === PLAYER ? 'player-turn' : 'ai-turn'
                }`}>
                  {currentPlayer === PLAYER ? '🔴 Your Turn' : '🟡 AI Thinking...'}
                </div>
              )}
            </div>

            {/* Game Board */}
            <div className="game-board">
              <div className="board-grid">
                {[...Array(ROWS)].flatMap((_, row) =>
                  [...Array(COLS)].map((_, col) => (
                    <div
                        key={row * COLS + col}
                        className={`cell ${
                          board[row][col] === PLAYER ? 'player' :
                          board[row][col] === AI ? 'ai' : ''
                        } ${
                          winningCells.some(([r, c]) => r === row && c === col) ? 'winning' : ''
                        }`}
                        style={{
                          cursor: (!isGameOver && currentPlayer === PLAYER &&
                                   board[0][col] === EMPTY) ? 'pointer' : 'default'
                        }}
                        onClick={() => handleColumnClick(col)}
                      />
                    ))
                )}
              </div>
            </div>

            {/* Restart Button */}
            <div className="text-center mt-4">
              <Button className="btn-restart" onClick={resetGame}>
                🔄 New Game
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default App;