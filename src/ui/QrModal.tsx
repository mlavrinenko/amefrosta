import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../i18n';
import { encodeTx, scoreWord } from '../engine';
import type { Cipher } from '../engine/types';
import type { Side, Transmission } from '../state/state';
import { formatScore } from './score';

export function QrModal({
  tx,
  side,
  cipher,
  onClose,
}: {
  tx: Transmission;
  side: Side;
  cipher: Cipher | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qrScore = side === 'alien' && cipher ? scoreWord(cipher, tx.word) : null;
  const payload = encodeTx({ w: tx.word, s: qrScore });

  return (
    <div className="modal-backdrop qr-modal" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {tx.word} <span className="tx-value">{formatScore(tx.value)}</span>
        </h3>
        <div className="qr-wrap">
          <QRCodeSVG value={payload} size={240} level="M" bgColor="#ffffff" fgColor="#0b1020" />
        </div>
        <p className="muted small">{t('tx.showHint')}</p>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
