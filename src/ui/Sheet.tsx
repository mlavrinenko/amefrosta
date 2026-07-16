import { type ReactNode, useEffect } from 'react';
import { useI18n } from '../i18n';

/** Bottom sheet overlay: dimmed backdrop, title bar, close button. */
export function Sheet({
  title,
  onClose,
  action,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Optional control rendered in the header, between the title and Close. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          {action}
          <button type="button" className="link" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
