import React, { useEffect, useState } from 'react';
import { useZKChessState } from '../api/UIStateManager';
import { isGhost, compareLoc, getScores } from '../utils/ChessUtils';
import { GameStatus } from '../_types/global/GlobalTypes';
import { TurnState } from './Game';

export function GameControls() {
  const { state } = useZKChessState();

  const {
    computed: { board },
    session: { selected, staged, turnState },
  } = state;

  const [ghostCanAct, setGhostCanAct] = useState<boolean>(false);

  useEffect(() => {
    if (!selected || staged || !isGhost(selected)) {
      setGhostCanAct(false);
      return;
    }

    // if the cell the ghost is on has an enemy piece
    for (const row of board) {
      for (const cell of row) {
        if (cell.piece && cell.ghost && cell.piece.owner !== cell.ghost.owner) {
          // should always be true, but a fallback just in case
          const fallback = compareLoc(selected.location, cell.ghost.location);
          setGhostCanAct(fallback);
          return;
        }
      }
    }
  }, [selected, staged, state.game]);

  const submitMove = () => {
    // if (staged && selected !== null) {
    //   if (isGhost(selected)) gm.moveGhost(selected.id, staged[0]);
    //   else gm.movePiece(selected.id, staged[0]);
    //   setters.updateTurnState(TurnState.Submitting);
    // }
  };

  const ghostAttack = () => {
    // gm.ghostAttack();
    // setters.updateTurnState(TurnState.Submitting);
  };

  return (
    <div>
      {state.game.gameState?.gameStatus !== GameStatus.COMPLETE ? (
        <p>
          {turnState === TurnState.Moving && (
            <span>
              your turn! move a piece...{' '}
              {staged && <u onClick={submitMove}>click to confirm</u>}
              {ghostCanAct && <u onClick={ghostAttack}>attack</u>}
            </span>
          )}
          {turnState === TurnState.Submitting && (
            <span>submitting move...</span>
          )}
          {turnState === TurnState.Waiting && (
            <span>move confirmed. awaiting other player...</span>
          )}
        </p>
      ) : (
        <>
          <p>game complete! winner: {'TODO: CALCULATE SCORES'}</p>
          <p>
            scores: <br />
            {getScores(state.game.gameState).map((entry, i) => (
              <>
                player {i + 1} ({entry.player.address}): {entry.score} <br />
              </>
            ))}
          </p>
        </>
      )}
    </div>
  );
}