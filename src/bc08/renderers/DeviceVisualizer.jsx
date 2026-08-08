import { useEffect, useRef, useState, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { matrix3dFromQuad } from './perspective.js';

function colorToHex(c) {
  const num = Number(c) || 0;
  return '#' + num.toString(16).padStart(6, '0').toUpperCase();
}

function rgbColor(state) {
  if (!state) return '#000000';
  if (state.mode === 'solid' || state.effect) {
    return colorToHex(state.color);
  }
  // For multi-zone mode, blend the four zones into one representative color.
  const zones = state.zones || [0, 0, 0, 0];
  let r = 0, g = 0, b = 0;
  for (const c of zones) {
    const num = Number(c) || 0;
    r += (num >> 16) & 0xff;
    g += (num >> 8) & 0xff;
    b += num & 0xff;
  }
  r = Math.round(r / zones.length);
  g = Math.round(g / zones.length);
  b = Math.round(b / zones.length);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Screen corners on the original product image public/raw/bc08-1.png (1024x768).
// Order: top-left, top-right, bottom-right, bottom-left.
const IMAGE_SCREEN_QUAD = [
  [520, 268],
  [750, 298],
  [703, 664],
  [490, 620],
];
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768;

export function DeviceVisualizer({ screenCanvas, rgbState }) {
  const { t } = useI18n();
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const wrapperRef = useRef(null);
  const [overlayTransform, setOverlayTransform] = useState('none');

  const rgbColorValue = useMemo(() => rgbColor(rgbState), [rgbState]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !screenCanvas) return;

    const ctx = overlay.getContext('2d');
    overlay.width = screenCanvas.width;
    overlay.height = screenCanvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(screenCanvas, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [screenCanvas]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !screenCanvas) return;

    const updateTransform = () => {
      const scaleX = wrapper.clientWidth / IMAGE_WIDTH;
      const scaleY = wrapper.clientHeight / IMAGE_HEIGHT;
      const dstQuad = IMAGE_SCREEN_QUAD.map(([x, y]) => [x * scaleX, y * scaleY]);
      setOverlayTransform(matrix3dFromQuad(screenCanvas.width, screenCanvas.height, dstQuad));
    };

    updateTransform();
    const ro = new ResizeObserver(updateTransform);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [screenCanvas]);

  return (
    <div className="relative h-full flex items-center justify-center bg-gray-900 border border-gray-700 rounded p-4">
      <div ref={wrapperRef} className="relative h-full" style={{ width: 'auto' }}>
        <img
          src="/raw/bc08-1.png"
          alt="BC08 Device"
          className="h-full w-auto max-w-full object-contain"
        />

        {/* Live screen overlay mapped to the product photo screen area */}
        {screenCanvas && (
          <canvas
            ref={overlayRef}
            className="absolute pointer-events-none left-0 top-0"
            style={{
              width: `${screenCanvas.width}px`,
              height: `${screenCanvas.height}px`,
              backgroundColor: '#000',
              transform: overlayTransform,
              transformOrigin: '0 0',
            }}
          />
        )}

        <svg className="absolute inset-0 w-full h-full text-cyan-400 pointer-events-none overflow-visible">
          {/* Label ①: SKILL Card screen */}
          <line x1="68%" y1="45%" x2="90%" y2="12%" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="68%" cy="45%" r="2.5" fill="currentColor" />
          <circle cx="90%" cy="12%" r="2.5" fill="currentColor" />
          <g>
            <rect
              x="72%"
              y="8%"
              width="20%"
              height="8%"
              rx="4"
              fill="rgba(0,0,0,0.6)"
            />
            <text
              x="91%"
              y="12%"
              fill="currentColor"
              fontSize="11"
              fontWeight="bold"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {t('device-label-screen')}
            </text>
          </g>

          {/* Label ②: RGB light */}
          <line x1="18%" y1="52%" x2="8%" y2="85%" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18%" cy="52%" r="2.5" fill="currentColor" />
          <circle cx="8%" cy="85%" r="2.5" fill="currentColor" />
          <g>
            <rect
              x="2%"
              y="81%"
              width="28%"
              height="8%"
              rx="4"
              fill="rgba(0,0,0,0.6)"
            />
            <text
              x="5%"
              y="85%"
              fill="currentColor"
              fontSize="11"
              fontWeight="bold"
              textAnchor="start"
              dominantBaseline="middle"
            >
              {t('device-label-rgb')}
            </text>
            <circle
              cx="28%"
              cy="85%"
              r="10"
              fill={rgbColorValue}
              stroke="currentColor"
              strokeWidth="1"
              style={{
                filter: `drop-shadow(0 0 6px ${rgbColorValue})`,
              }}
            />
          </g>
        </svg>
      </div>

      <div className="absolute bottom-3 text-xs text-gray-400">BC08 Device / SKILL Card Area</div>
    </div>
  );
}
