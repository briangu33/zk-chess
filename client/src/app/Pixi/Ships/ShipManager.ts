import { PixiManager, GameZIndex } from '../../../api/PixiManager';
import { BoardCoords } from '../@PixiTypes';
import { PixiObject } from '../PixiObject';
import { compareBoardCoords } from '../Utils/PixiUtils';
import { PieceObject } from './PieceObject';
import { Ship } from './Ship';
import { Submarine } from './Submarine';

enum ShipZIndex {
  Below,
  Above,
}

class PieceLayer extends PixiObject {
  showWhen: boolean;

  constructor(manager: PixiManager, showWhen: boolean) {
    super(manager);

    this.showWhen = showWhen;
  }

  loop() {
    super.loop();
    const { showZk } = this.manager.mouseManager;
    const show = showZk === this.showWhen;
    this.setAlpha(show ? 1 : 0.5);
    this.setZIndex(show ? ShipZIndex.Above : ShipZIndex.Below);
  }
}

export class ShipManager extends PixiObject {
  shipLayer: PieceLayer;
  subLayer: PieceLayer;

  ships: Ship[];
  submarines: Submarine[];

  constructor(manager: PixiManager) {
    super(manager, GameZIndex.Ships);
    this.ships = [];
    this.submarines = [];

    this.shipLayer = new PieceLayer(manager, false); // show when zk is false
    this.subLayer = new PieceLayer(manager, true); // show when zk is true

    this.addChild(this.shipLayer, this.subLayer);
  }

  removeLazy(obj: PixiObject) {
    obj.setActive(false);
  }

  // TODO this abstraction no longer makes sense now that ships live in a different arr
  flush() {
    const { shipLayer, subLayer, ships, submarines: subs } = this;

    for (let i = 0; i < ships.length; i++) {
      if (!ships[i].active) {
        shipLayer.object.removeChild(ships[i].object);
        ships.splice(i--, 1);
      }
    }

    for (let i = 0; i < subs.length; i++) {
      if (!subs[i].active) {
        subLayer.object.removeChild(subs[i].object);
        subs.splice(i--, 1);
      }
    }
  }

  clear() {
    for (const ship of this.ships) this.removeLazy(ship);
    for (const sub of this.submarines) this.removeLazy(sub);
    this.flush(); // TODO debug this, seems broken
    this.ships = [];
    this.submarines = [];
  }

  getPieceWithId(id: number): PieceObject | null {
    for (const ship of this.ships) {
      if (ship.pieceData.id === id) return ship;
    }
    for (const sub of this.submarines) {
      if (sub.pieceData.id === id) return sub;
    }

    return null;
  }

  // add all of this to the API level
  addShip(obj: Ship) {
    this.shipLayer.addChild(obj);
    this.ships.push(obj);
  }

  addSubmarine(obj: Submarine) {
    this.subLayer.addChild(obj);
    this.submarines.push(obj);
  }

  getSubsAtIdx(idx: BoardCoords): Submarine[] {
    const subs: Submarine[] = [];
    for (const sub of this.submarines) {
      if (compareBoardCoords(sub.getCoords(), idx)) subs.push(sub);
    }

    return subs;
  }

  getSubIdx(obj: Submarine): number {
    const loc = obj.getCoords();
    if (loc) {
      const sortedIds = this.getSubsAtIdx(loc)
        .filter((sub) => sub.isAlive())
        .map((sub) => sub.pieceData.id)
        .sort();
      return sortedIds.indexOf(obj.pieceData.id);
    } else return 0;
  }
}
