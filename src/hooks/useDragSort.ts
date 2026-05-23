import { useEffect, useRef, useState } from 'react';

/**
 * Unified drag-sort hook — works with both HTML5 drag (desktop) and
 * touch/pointer events (mobile). Each draggable item must have a
 * `data-drag-idx` attribute equal to its index in the list.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement | null>(null);
 *   const drag = useDragSort(containerRef, (from, to) => reorder(from, to));
 *
 *   <div ref={containerRef}>
 *     {items.map((item, i) => (
 *       <div
 *         key={item.id}
 *         data-drag-idx={i}
 *         draggable
 *         onDragStart={() => drag.startDrag(i)}
 *         onDragOver={(e) => drag.overDrag(e, i)}
 *         onDragLeave={drag.leaveDrag}
 *         onDrop={() => drag.dropDrag(i)}
 *         onDragEnd={drag.endDrag}
 *         onTouchStart={() => drag.startTouch(i)}
 *         onTouchEnd={drag.endTouch}
 *       />
 *     ))}
 *   </div>
 */
export function useDragSort(
  containerRef: React.RefObject<HTMLElement | null>,
  onReorder: (from: number, to: number) => void,
) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Refs hold the live values so event callbacks don't close over stale state
  const dragIdxRef = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Attach touchmove with { passive: false } so we can call preventDefault()
  // and block the page from scrolling while the user is dragging a list item.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchMove = (e: TouchEvent) => {
      if (dragIdxRef.current === null) return;
      e.preventDefault(); // stop scroll while dragging

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const item = el?.closest('[data-drag-idx]') as HTMLElement | null;
      if (!item) return;

      const idx = parseInt(item.dataset.dragIdx ?? '');
      if (!Number.isNaN(idx)) {
        dragOverIdxRef.current = idx;
        setDragOverIdx(idx);
      }
    };

    container.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', onTouchMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // containerRef is stable after mount

  // ── Touch handlers ────────────────────────────────────────────────────────

  const startTouch = (idx: number) => {
    dragIdxRef.current = idx;
    dragOverIdxRef.current = idx;
    setDragIdx(idx);
    setDragOverIdx(idx);
  };

  const endTouch = () => {
    const from = dragIdxRef.current;
    const to = dragOverIdxRef.current;
    dragIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDragIdx(null);
    setDragOverIdx(null);
    if (from !== null && to !== null && from !== to) {
      onReorderRef.current(from, to);
    }
  };

  // ── HTML5 drag handlers (desktop) ─────────────────────────────────────────

  const startDrag = (idx: number) => {
    dragIdxRef.current = idx;
    setDragIdx(idx);
  };

  const overDrag = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdxRef.current = idx;
    setDragOverIdx(idx);
  };

  const leaveDrag = () => {
    dragOverIdxRef.current = null;
    setDragOverIdx(null);
  };

  const dropDrag = (targetIdx: number) => {
    const from = dragIdxRef.current;
    dragIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDragIdx(null);
    setDragOverIdx(null);
    if (from !== null && from !== targetIdx) {
      onReorderRef.current(from, targetIdx);
    }
  };

  const endDrag = () => {
    dragIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return {
    dragIdx,
    dragOverIdx,
    startTouch,
    endTouch,
    startDrag,
    overDrag,
    leaveDrag,
    dropDrag,
    endDrag,
  };
}
