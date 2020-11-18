import { PixiManager } from '../../../api/PixiManager';
import { ClickState } from '../MouseManager';
import { LinkObject } from '../Utils/LinkObject';
import { TextAlign } from '../Utils/Text';

export class CancelButton extends LinkObject {
  constructor(manager: PixiManager) {
    super(manager, 'Cancel', TextAlign.Right);
  }
  onClick() {
    this.manager.mouseManager.cancel();
  }
  isEnabled() {
    const {
      api,
      mouseManager: { selectedShip, clickState },
    } = this.manager;
    if (!api.isMyTurn()) return false;
    if (clickState !== ClickState.None) return true;

    return !!selectedShip;
  }
}