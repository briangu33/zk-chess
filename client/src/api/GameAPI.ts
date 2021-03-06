import { BoardCoords, MoveAttack, PlayerColor } from '../app/Pixi/@PixiTypes';
import {
  ChessGame,
  EthAddress,
  GameStatus,
  isVisiblePiece,
  Piece,
  PieceStatDefaults,
  PieceType,
  Player,
  VisiblePiece,
} from '../_types/global/GlobalTypes';
import AbstractGameManager, { GameManagerEvent } from './AbstractGameManager';
import { PixiManager } from './PixiManager';
import { GAME_HEIGHT, GAME_WIDTH } from '../app/Pixi/GameBoard/GameBoard';
import autoBind from 'auto-bind';
import { findPath, getObstacles } from '../utils/Utils';
import { Ship } from '../app/Pixi/Ships/Ship';
import { PieceObject } from '../app/Pixi/Ships/PieceObject';
import { Submarine } from '../app/Pixi/Ships/Submarine';
import {
  boardLocFromCoords,
  compareBoardCoords,
  taxiCab,
} from '../app/Pixi/Utils/PixiUtils';
import { playerShader } from '../app/Pixi/Utils/Shaders';
import { TransactionManager } from '../app/PixiAppComponents/TransactionList';
import { setGameIdForTable } from './UtilityServerAPI';
import { difference } from 'lodash';
import _ from 'lodash';
import Game from '../app/Game';
import { playSFX, SFX } from '../app/Pixi/Utils/SoundLoader';

export enum InitState {
  NotJoined,
  WaitingForPlayers,
  GameStarted,
}

export class GameAPI {
  private pixiManager: PixiManager;
  private gameManager: AbstractGameManager;
  private myMothership: Ship;

  private p1Mothership: VisiblePiece;
  private p2Mothership: VisiblePiece;

  gameState: ChessGame;

  didJoin: boolean = false;

  constructor(pixiManager: PixiManager, gameManager: AbstractGameManager) {
    this.pixiManager = pixiManager;
    this.gameManager = gameManager;

    this.gameState = this.gameManager.getGameState();
    console.log(this.gameState);

    autoBind(this);

    const gm = this.gameManager;

    gm.addListener(GameManagerEvent.StateAdvanced, this.stateAdvanced);
    gm.addListener(GameManagerEvent.StateRewinded, this.stateAdvanced);
    gm.addListener(GameManagerEvent.GameStart, this.stateAdvanced);
    gm.addListener(GameManagerEvent.CreatedGame, this.stateAdvanced);

    gm.addListener(GameManagerEvent.TxReverted, this.error);
    gm.addListener(GameManagerEvent.TxSubmitFailed, this.error);

    TransactionManager.initialize(gameManager);
  }

  private error() {
    console.error('tx failed');
    this.stateAdvanced();
  }

  // event listeners
  private stateAdvanced() {
    console.log('state advanced');
    this.syncGameState();
  }

  // purges all existing ships and adds new ones
  syncShips(): void {
    const { shipManager } = this.pixiManager;

    shipManager.clear();
    const { pieces, myAddress, player1 } = this.gameState;
    for (const piece of pieces) {
      if (isVisiblePiece(piece)) {
        const ship = new Ship(this.pixiManager, piece);
        if (piece.pieceType === PieceType.Mothership_00) {
          if (piece.owner === myAddress) {
            this.myMothership = ship;
          }
          if (piece.owner === player1.address) {
            this.p1Mothership = piece;
          } else {
            this.p2Mothership = piece;
          }
        }

        shipManager.addShip(ship);
      } else {
        const sub = new Submarine(this.pixiManager, piece);
        shipManager.addSubmarine(sub);
      }
    }
  }

  // note that this might somewhat break abstractions?
  syncObjectives(): void {
    const { objectiveManager: om } = this.pixiManager;

    om.clear();
    for (const obj of this.gameState.objectives) {
      om.addObjective(obj);
    }
  }

  // callable
  async newGame(): Promise<void> {
    const newGameId = Math.floor(Math.random() * 1000000).toString();
    await this.gameManager.createGame(newGameId);
    await setGameIdForTable(this.pixiManager.tableId, newGameId);
    await this.gameManager.setGame(newGameId);
    this.stateAdvanced();
  }

  joinGame(): void {
    this.gameManager.joinGame();
    this.didJoin = true;
  }

  endTurn(): void {
    this.gameManager.endTurn();
    this.syncGameState();
  }

  deploy(type: PieceType, coords: BoardCoords): void {
    this.gameManager.summonPiece(type, boardLocFromCoords(coords));
    this.syncGameState();
  }

  move(ship: PieceObject, to: BoardCoords): void {
    console.log(ship.pieceData.id, to);
    this.gameManager.movePiece(ship.pieceData.id, boardLocFromCoords(to));
    this.syncGameState();
  }

  attack(from: PieceObject, to: BoardCoords): void {
    const toShip = this.shipAt(to);
    if (toShip) {
      this.gameManager.attack(from.pieceData.id, toShip.pieceData.id);
    }
    this.syncGameState();
  }

  moveAttack(
    from: PieceObject,
    moveTo: BoardCoords,
    attackTo: BoardCoords
  ): void {
    this.move(from, moveTo);
    this.syncGameState();
    setTimeout(() => {
      this.attack(from, attackTo);
      this.syncGameState();
    }, 500);
  }

  // finding tiles

  findAttacks(type: PieceType, coords: BoardCoords): BoardCoords[] {
    const attacks: BoardCoords[] = [];

    for (let row = 0; row < GAME_HEIGHT; row++) {
      for (let col = 0; col < GAME_WIDTH; col++) {
        if (this.canAttack(type, coords, { row, col }))
          attacks.push({ row, col });
      }
    }

    return attacks;
  }

  findMoves(type: PieceType, coords: BoardCoords): BoardCoords[] {
    const paths: BoardCoords[] = [];
    // TODO minor optimization using range
    for (let row = 0; row < GAME_HEIGHT; row++) {
      for (let col = 0; col < GAME_WIDTH; col++) {
        if (this.canMove(type, coords, { row, col })) paths.push({ row, col });
      }
    }

    return paths;
  }

  findMoveAttacks(type: PieceType, coords: BoardCoords): MoveAttack[] {
    const { nRows, nCols } = this.gameState;
    const canMoves: (BoardCoords | null)[][] = [...Array(nRows)].map((_el) =>
      Array(nCols).fill(null)
    );

    const allMoves = this.findMoves(type, coords).concat([coords]);

    for (const move of allMoves) {
      const locAtks = this.findAttacks(type, move);
      for (const atk of locAtks) canMoves[atk.row][atk.col] = move;
    }

    const allAttacks: MoveAttack[] = [];
    for (let i = 0; i < canMoves.length; i++) {
      for (let j = 0; j < canMoves[i].length; j++) {
        const atkLoc = { row: i, col: j };
        const moveLoc = canMoves[i][j];
        if (moveLoc) allAttacks.push({ move: moveLoc, attack: atkLoc });
      }
    }

    return allAttacks;
  }

  // getters
  getInitState(): InitState {
    const { myAddress, player1, player2, gameStatus } = this.gameState;

    if (gameStatus !== GameStatus.WAITING_FOR_PLAYERS)
      return InitState.GameStarted;

    if (
      player1.address !== myAddress &&
      player2.address !== myAddress &&
      !this.didJoin
    )
      return InitState.NotJoined;
    else return InitState.WaitingForPlayers;
  }

  canBuy(type: PieceType): boolean {
    return this.getStats(type).cost <= this.getGold();
  }

  getStats(type: PieceType): PieceStatDefaults {
    return this.gameState.defaults[type];
  }

  getMyMothership(): Ship | null {
    return this.myMothership || null;
  }

  isMyTurn(): boolean {
    const status = this.gameState.gameStatus;
    const amP1 = this.amPlayer1();
    if (amP1) return status === GameStatus.P1_TO_MOVE;
    else return status === GameStatus.P2_TO_MOVE;
  }

  whoseTurn(): PlayerColor {
    const status = this.gameState.gameStatus;
    return status === GameStatus.P1_TO_MOVE
      ? PlayerColor.Red
      : PlayerColor.Blue;
  }

  gameAbandoned(): number | null {
    const { lastTurnTimestamp, gameStatus } = this.gameState;
    const secElapsed = Date.now() / 1000 - lastTurnTimestamp;
    const minutes = secElapsed / 60;

    if (minutes > 5 && gameStatus !== GameStatus.WAITING_FOR_PLAYERS)
      return minutes;

    return null;
  }

  gameOver(): boolean {
    return this.gameState.gameStatus === GameStatus.COMPLETE;
  }

  getWinner(): PlayerColor | null {
    if (!this.gameOver()) return null;
    if (this.p1Mothership.hp === 0) return PlayerColor.Blue;
    else if (this.p2Mothership.hp === 0) return PlayerColor.Red;

    return null;
  }

  // p1 is red, p2 is blue
  getMyColor(): PlayerColor {
    return this.getColor(this.gameState.myAddress);
  }

  getColor(address: EthAddress | null): PlayerColor {
    const { player1, player2 } = this.gameState;
    if (address === player1.address) return PlayerColor.Red;
    else if (address === player2.address) return PlayerColor.Blue;
    else {
      // console.error('error getting color');
      return PlayerColor.Red;
    }
  }

  shipAt(coords: BoardCoords): Ship | null {
    const ships = this.pixiManager.shipManager.ships;
    for (const ship of ships) {
      if (ship.isAlive() && compareBoardCoords(ship.coords, coords))
        return ship;
    }

    return null;
  }

  subAt(coords: BoardCoords): Submarine | null {
    const subs = this.pixiManager.shipManager.submarines;
    for (const sub of subs) {
      if (sub.isAlive() && compareBoardCoords(sub.getCoords(), coords))
        return sub;
    }

    return null;
  }

  ownedByMe(ship: PieceObject): boolean {
    return ship.pieceData.owner === this.gameState.myAddress;
  }

  getOwner(ship: PieceObject): PlayerColor {
    return this.getColor(ship.pieceData.owner);
  }

  getGold(): number {
    const amP1 = this.amPlayer1();
    if (amP1) return this.gameState.player1Mana;
    else return this.gameState.player2Mana;
  }

  getMaxGold(): number {
    return Math.min(this.gameState.turnNumber, 8);
  }

  getHealth(): number {
    if (this.getInitState() !== InitState.GameStarted) return 0;
    return this.myMothership.pieceData.hp;
  }

  inBounds(coords: BoardCoords): boolean {
    const { nRows, nCols } = this.gameState;
    if (
      coords.col >= nCols ||
      coords.row >= nRows ||
      coords.col < 0 ||
      coords.row < 0
    )
      return false;
    return true;
  }

  // TODO invert these to canMoveNow and canAttackNow
  hasMoved(ship: PieceObject): boolean {
    if (this.whoseTurn() !== this.getOwner(ship)) return true;
    return (
      ship.pieceData.lastMove === this.gameState.turnNumber &&
      !this.hasAttacked(ship)
    );
  }

  hasAttacked(ship: PieceObject): boolean {
    if (this.whoseTurn() !== this.getOwner(ship)) return true;
    return ship.pieceData.lastAttack === this.gameState.turnNumber;
  }

  /* diffing engine */
  private diff(oldState: ChessGame, newState: ChessGame) {
    this.diffTurn(oldState, newState);
    this.diffPieces(oldState, newState);
  }

  private diffTurn(oldState: ChessGame, _newState: ChessGame) {
    const newState = this.gameState;
    if (
      oldState.gameStatus !== newState.gameStatus &&
      newState.gameStatus !== GameStatus.COMPLETE &&
      newState.gameStatus !== GameStatus.WAITING_FOR_PLAYERS &&
      this.isMyTurn()
    ) {
      console.log('its your turn now!');
      this.pixiManager.yourTurn.ping();
    }
  }

  private diffPieces(oldState: ChessGame, newState: ChessGame) {
    const oldIds = oldState.pieces.map((piece) => piece.id);
    const newIds = newState.pieces.map((piece) => piece.id);

    for (const id of newIds) {
      const oldPiece = oldState.pieceById.get(id);
      const newPiece = newState.pieceById.get(id);

      // check if a new piece has been deployed
      if (!oldIds.includes(id)) {
        const ship = this.pixiManager.shipManager.getPieceWithId(id);
        if (ship) ship.pingDeploy();
        continue;
      }

      // check if a piece was destroyed
      if (oldPiece && oldPiece.alive && newPiece && !newPiece.alive) {
        const ship = this.pixiManager.shipManager.getPieceWithId(id);
        if (ship) ship.pingDestroy();
        continue;
      }

      // check if a piece was damaged
      if (
        oldPiece &&
        newPiece &&
        oldPiece.alive &&
        newPiece.alive &&
        oldPiece.hp > newPiece.hp
      ) {
        const ship = this.pixiManager.shipManager.getPieceWithId(id);
        if (ship) ship.pingDamage();
        continue;
      }

      // check if a piece was buffed
      if (
        oldPiece &&
        newPiece &&
        oldPiece.alive &&
        newPiece.alive &&
        (oldPiece.hp < newPiece.hp || oldPiece.atk < newPiece.atk)
      ) {
        const ship = this.pixiManager.shipManager.getPieceWithId(id);
        if (ship) ship.pingBuff();
        continue;
      }
    }
  }

  /* private utils */
  private syncGameState(): void {
    const oldState = _.cloneDeep(this.gameState);
    this.gameState = this.gameManager.getLatestGameState();
    console.log(this.gameState);
    this.syncShips();
    this.syncObjectives();

    this.diff(oldState, _.clone(this.gameManager.getLatestGameState()));
  }

  private canMove(
    type: PieceType,
    from: BoardCoords,
    to: BoardCoords
  ): boolean {
    if (type === PieceType.Submarine_04) return this.canMoveSub(type, from, to);
    else return this.canMoveShip(type, from, to);
  }

  private canMoveSub(
    type: PieceType,
    from: BoardCoords,
    to: BoardCoords
  ): boolean {
    if (!this.inBounds(to)) return false;
    const data = this.getStats(type);
    const dist = taxiCab(from, to);

    return dist <= data.mvRange;
  }

  private canMoveShip(
    type: PieceType,
    from: BoardCoords,
    to: BoardCoords
  ): boolean {
    if (!this.inBounds(to)) return false;

    const { nRows, nCols } = this.gameState;
    const data = this.getStats(type);
    const dist = taxiCab(from, to);

    if (dist > 0 && dist <= data.mvRange) {
      const obstacles = getObstacles(this.gameState);
      const fromLoc = boardLocFromCoords(from);
      const toLoc = boardLocFromCoords(to);
      const path = findPath(fromLoc, toLoc, nRows, nCols, obstacles, false);
      if (path && path.length <= data.mvRange) {
        return true;
      }
    }

    return false;
  }

  canAttack(type: PieceType, from: BoardCoords, to: BoardCoords): boolean {
    if (!this.inBounds(to)) return false;

    // TODO make this get data from contract
    const data = this.getStats(type);
    const dist = taxiCab(from, to);
    if (data.atkMinRange <= dist && dist <= data.atkMaxRange) {
      const ship = this.shipAt(to);
      if (ship && this.ownedByMe(ship)) return false;
      return true;
    }

    return false;
  }

  private amPlayer1(): boolean {
    return this.getMyColor() === PlayerColor.Red;
  }

  // drawing cards
  draw(idx: number) {
    playSFX(SFX.BtnClick);
    this.gameManager.drawCard(idx);
    this.syncGameState();
  }

  cast(pieceId: number, idx: number) {
    this.gameManager.playCard(pieceId, idx);
    this.syncGameState();
  }
}
