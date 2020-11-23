import { PixiManager } from '../../../api/PixiManager';
import { PixiObject } from '../PixiObject';
import { GameGrid } from './GameGrid';

export class GameBoardObject extends PixiObject {
  constructor(manager: PixiManager, grid: GameGrid) {
    super(manager);

    if (manager.spectator) {
      this.setActive(false);
      return;
    }

    this.positionGrid(grid.getWidth(), grid.getHeight());
  }

  positionGrid(_gridW: number, _gridH: number) {
    return;
  }
}
