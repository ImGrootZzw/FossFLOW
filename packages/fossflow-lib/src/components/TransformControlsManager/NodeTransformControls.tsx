import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useViewItem } from 'src/hooks/useViewItem';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition } from 'src/types';
import { TransformControls } from './TransformControls';
import { getTilePosition } from 'src/utils';
import { PROJECTED_TILE_SIZE, TRANSFORM_CONTROLS_COLOR } from 'src/config';

interface Props {
  id: string;
}

export const NodeTransformControls = ({ id }: Props) => {
  const node = useViewItem(id);
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const mouse = useUiStateStore((state) => {
    return state.mouse;
  });
  const setMode = useUiStateStore((state) => {
    return state.actions.setMode;
  });

  const nodeId = node?.id;
  const nodeTile = node?.tile;

  const onAnchorMouseDown = useCallback(
    (anchorPosition: AnchorPosition) => {
      if (!nodeId || !nodeTile) return;

      setMode({
        type: 'NODE.TRANSFORM',
        id: nodeId,
        selectedAnchor: anchorPosition,
        showCursor: true,
        startTile: mouse.position.tile,
        originTile: nodeTile
      });
    },
    [nodeId, nodeTile, mouse.position.tile, setMode]
  );

  if (!node) {
    return null;
  }

  const isDragging =
    mode.type === 'NODE.TRANSFORM' && mode.id === node.id;

  // Anchor the coordinate badge just below the selected tile
  const badgePosition = getTilePosition({
    tile: node.tile,
    origin: 'BOTTOM'
  });

  return (
    <>
      <TransformControls
        from={node.tile}
        to={node.tile}
        onAnchorMouseDown={onAnchorMouseDown}
      />

      {/* Live tile coordinates for the selected node */}
      <Box
        sx={{
          position: 'absolute',
          left: badgePosition.x,
          top: badgePosition.y + PROJECTED_TILE_SIZE.height * 0.35,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          bgcolor: isDragging
            ? TRANSFORM_CONTROLS_COLOR
            : 'rgba(0, 0, 0, 0.72)',
          color: '#fff',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          whiteSpace: 'nowrap'
        }}
      >
        <Typography sx={{ fontSize: 11, lineHeight: 1.4, fontWeight: 600 }}>
          x {node.tile.x}, y {node.tile.y}
        </Typography>
      </Box>
    </>
  );
};
