import {EventEmitter} from 'events';
import {
  BoardLocation,
  ChessGame,
  EthAddress,
} from '../_types/global/GlobalTypes';
import ContractsAPI from './ContractsAPI';
import SnarkHelper from './SnarkArgsHelper';
import _ from 'lodash';

import AbstractGameManager from './AbstractGameManager';

import {ContractsAPIEvent} from '../_types/darkforest/api/ContractsAPITypes';
import {emptyAddress} from '../utils/CheckedTypeUtils';
import {getRandomActionId} from '../utils/Utils';

class GameManager extends EventEmitter implements AbstractGameManager {
  private readonly account: EthAddress | null;

  private readonly contractsAPI: ContractsAPI;
  private readonly snarkHelper: SnarkHelper;

  private constructor(
    account: EthAddress | null,
    contractsAPI: ContractsAPI,
    snarkHelper: SnarkHelper
  ) {
    super();

    this.account = account;

    this.contractsAPI = contractsAPI;
    this.snarkHelper = snarkHelper;
  }

  public destroy(): void {
    // removes singletons of ContractsAPI, SnarkHelper
    this.contractsAPI.removeAllListeners(ContractsAPIEvent.ProofVerified);

    this.contractsAPI.destroy();
    this.snarkHelper.destroy();
  }

  static async create(): Promise<GameManager> {
    // initialize dependencies according to a DAG

    // first we initialize the ContractsAPI and get the user's eth account, and load contract constants + state
    const contractsAPI = await ContractsAPI.create();

    // then we initialize the local storage manager and SNARK helper
    const account = contractsAPI.account;
    const snarkHelper = SnarkHelper.create();

    // get data from the contract
    const gameManager = new GameManager(account, contractsAPI, snarkHelper);

    // set up listeners: whenever ContractsAPI reports some game state update, do some logic
    gameManager.contractsAPI.on(ContractsAPIEvent.ProofVerified, () => {
      console.log('proof verified');
    });

    return gameManager;
  }

  getGameAddr(): EthAddress | null {
    return null;
  }

  getGameState(): ChessGame {
    return {
      myAddress: emptyAddress,
      player1: {address: emptyAddress},
      player2: {address: emptyAddress},
      turnNumber: 0,
      myPieces: [],
      theirPieces: [],
      myGhost: {id: 0, owner: emptyAddress, location: [0, 0]},
      objectives: [],
    };
  }

  joinGame(): Promise<void> {
    return Promise.resolve();
  }

  movePiece(pieceId: number, to: BoardLocation): Promise<void> {
    return Promise.resolve();
  }

  moveGhost(ghostId: number, to: BoardLocation): Promise<void> {
    return Promise.resolve();
  }

  ghostAttack(): Promise<void> {
    return Promise.resolve();
  }

  makeProof(): GameManager {
    this.snarkHelper.getProof(1, 1, 1).then((args) => {
      this.contractsAPI.submitProof(args, getRandomActionId());
    });
    return this;
  }
}

export default GameManager;
