import autoBind from 'auto-bind';
import {EventEmitter} from 'events';
import AbstractUIManager, {GameUIManagerEvent} from './AbstractUIManager';
import AbstractGameManager from '../../api/AbstractGameManager';
import {GameManagerEvent} from '../../api/AbstractGameManager';
import {BoardLocation, ChessGame} from '../../_types/global/GlobalTypes';

class GameUIManager extends EventEmitter implements AbstractUIManager {
  private gameManager: AbstractGameManager;

  // lifecycle methods
  private constructor(gameManager: AbstractGameManager) {
    super();

    this.gameManager = gameManager;
    autoBind(this);
  }

  static create(gameManager: AbstractGameManager) {
    const uiManager = new GameUIManager(gameManager);

    uiManager.addListener(
      GameManagerEvent.MoveConfirmed,
      uiManager.onMoveConfirmed
    );

    return uiManager;
  }

  destroy(): void {
    this.gameManager.destroy();
    this.removeAllListeners(GameManagerEvent.MoveConfirmed);
  }

  getGameState(): ChessGame {
    return this.gameManager.getGameState();
  }

  movePiece(pieceId: number, to: BoardLocation): void {
    console.log('moved piece!');
    this.gameManager.movePiece(pieceId, to);
  }

  moveGhost(ghostId: number, to: BoardLocation): void {
    this.gameManager.movePiece(ghostId, to);
  }

  ghostAttack(): void {
    this.gameManager.ghostAttack();
  }

  joinGame(): Promise<void> {
    return this.gameManager.joinGame();
  }

  private onMoveConfirmed() {
    this.emit(GameUIManagerEvent.MoveConfirmed);
    console.log('update game');
  }
}

export default GameUIManager;
