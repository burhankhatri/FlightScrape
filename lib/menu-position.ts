/** Viewport-aware fixed positioning for portaled dropdowns / popovers */

export interface MenuLayout {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const PAD = 16;

export function computeMenuLayout(anchor: DOMRect): MenuLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isNarrow = vw < 640;

  const width = isNarrow
    ? vw - PAD * 2
    : Math.min(Math.max(anchor.width, 280), 352, vw - PAD * 2);

  let left = isNarrow ? PAD : anchor.left;
  if (left + width > vw - PAD) left = vw - PAD - width;
  if (left < PAD) left = PAD;

  const spaceBelow = vh - anchor.bottom - PAD;
  const spaceAbove = anchor.top - PAD;
  const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(
    isNarrow ? Math.floor(vh * 0.55) : 320,
    openBelow ? Math.max(160, spaceBelow - 10) : Math.max(160, spaceAbove - 10),
  );

  if (openBelow) {
    return {
      top: anchor.bottom + 6,
      left,
      width,
      maxHeight,
    };
  }

  return {
    bottom: vh - anchor.top + 6,
    left,
    width,
    maxHeight,
  };
}
