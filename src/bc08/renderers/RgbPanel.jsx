import { colorToCss } from './CanvasRenderer.js';
import { useI18n } from '../i18n/I18nContext';

export function RgbPanel({ state }) {
  const { t } = useI18n();
  const zones = state?.zones || [0, 0, 0, 0];
  const mode = state?.mode || 'solid';
  const effect = state?.effect;

  let displayZones = [...zones];
  if (mode === 'solid' || effect) {
    const c = state?.color || 0;
    displayZones = [c, c, c, c];
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 border border-gray-700 rounded p-2">
      <div className="text-sm font-medium text-gray-300 mb-1">{t('panel-rgb')}</div>
      <div className="flex-1 flex items-center justify-center gap-2">
        {displayZones.map((c, i) => {
          const color = colorToCss(c);
          const isOff = c === 0;
          return (
            <div
              key={i}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-700"
              style={{
                backgroundColor: color,
                boxShadow: isOff ? 'none' : `0 0 12px ${color}`,
              }}
            />
          );
        })}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        mode: {mode}{effect ? ` / ${effect}` : ''}
      </div>
    </div>
  );
}
