import { useEffect, useRef, useCallback } from 'react';
import { renderScreen, findControlAt, SCR_W, CANVAS_H, setImageRedrawCallback } from '../renderers/CanvasRenderer.js';

export function ScreenCanvas({ state, onClick, onCanvasReady }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    renderScreen(ctx, state);

    setImageRedrawCallback(() => {
      if (canvasRef.current) {
        renderScreen(canvasRef.current.getContext('2d'), state);
      }
    });
    return () => setImageRedrawCallback(null);
  }, [state]);

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => {
      onCanvasReady?.(null);
    };
  }, [onCanvasReady]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SCR_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hit = findControlAt(state, x, y);
    onClick(hit ? hit.pageId : null, hit ? hit.objId : null, x, y);
  }, [state, onClick]);

  return (
    <canvas
      ref={canvasRef}
      width={SCR_W}
      height={CANVAS_H}
      onClick={handleClick}
      className="max-h-full max-w-full cursor-pointer bg-black"
    />
  );
}
