import { useI18n } from '../i18n/I18nContext';

export function SimulatorLoading() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-header text-white mb-2">{t('simulator-loading-title')}</h2>
      <p className="text-gray-400 mb-4">{t('simulator-loading-desc')}</p>
      <p className="text-xs text-gray-500">{t('simulator-loading-note')}</p>
    </div>
  );
}
