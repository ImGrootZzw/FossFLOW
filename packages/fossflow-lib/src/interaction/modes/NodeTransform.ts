import { ModeActions } from 'src/types';
import {
  getItemByIdOrThrow,
  getItemAtTile,
  findNearestUnoccupiedTile,
  hasMovedTile,
  CoordsUtils
} from 'src/utils';

/**
 * Drag a node by its bounding-box handles.
 *
 * The drag is delta based (tile under the cursor at mousedown vs. now), so
 * grabbing any corner works without the cursor jumping to the tile centre.
 * The node snaps to tiles and falls back to the nearest free tile when the
 * target is occupied.
 */
export const TransformNode: ModeActions = {
  entry: () => {},
  exit: () => {},
  mousemove: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'NODE.TRANSFORM') return;

    const { id, startTile, originTile } = uiState.mode;

    // Without a recorded anchor position (e.g. clicked, not dragged) do nothing
    if (!startTile || !originTile) return;
    if (!hasMovedTile(uiState.mouse)) return;

    const node = getItemByIdOrThrow(scene.items, id).value;

    const delta = CoordsUtils.subtract(
      uiState.mouse.position.tile,
      startTile
    );
    const targetTile = CoordsUtils.add(originTile, delta);

    if (CoordsUtils.isEqual(targetTile, node.tile)) return;

    let nextTile = targetTile;

    // If another node occupies the target tile, snap to the nearest free one
    const occupant = getItemAtTile({ tile: targetTile, scene });
    if (occupant && occupant.type === 'ITEM' && occupant.id !== id) {
      const freeTile = findNearestUnoccupiedTile(targetTile, scene);
      if (!freeTile) return;
      nextTile = freeTile;
    }

    scene.updateViewItem(id, { tile: nextTile });
  },
  mousedown: () => {
    // Mousedown is handled by the anchor itself (see NodeTransformControls)
  },
  mouseup: ({ uiState }) => {
    if (uiState.mode.type !== 'NODE.TRANSFORM') return;

    uiState.actions.setMode({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  }
};
