import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useI18n } from '../i18n';
import { isSignalQr } from '../engine';

export function ScanModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (raw: string) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const importRef = useRef(onImport);
  importRef.current = onImport;

  const [text, setText] = useState('');
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera access requires a secure context; navigator.mediaDevices is
  // undefined over plain http on a LAN address (e.g. Firefox mobile).
  const cameraAvailable =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const startCamera = () => {
    if (!cameraAvailable) {
      setError(t('tx.scanInsecure'));
      return;
    }
    setCamera(true);
  };

  useEffect(() => {
    if (!camera || !videoRef.current) return;
    let controls: IScannerControls | undefined;
    const reader = new BrowserQRCodeReader();
    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, _err, c) => {
        controls = c;
        // Ignore any QR that isn't one of ours; keep scanning for a real one.
        if (result && isSignalQr(result.getText())) {
          c.stop();
          importRef.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
      })
      .catch((e) => setError(String(e)));
    return () => controls?.stop();
  }, [camera]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('tx.import')}</h3>
        {camera ? (
          <video ref={videoRef} className="scan-video" muted playsInline />
        ) : (
          <button type="button" onClick={startCamera}>
            {t('tx.scanCamera')}
          </button>
        )}
        {error && <p className="error small">{error}</p>}
        <div className="paste">
          <textarea
            className="notes"
            placeholder={t('tx.pastePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="primary" onClick={() => onImport(text.trim())}>
            {t('tx.importPaste')}
          </button>
        </div>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
