import { openUrl } from '@tauri-apps/plugin-opener';
import './ConnectionDialog.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faXmark } from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import { fetchQRToken, getClientConnectionUrl } from '../../services/api';

interface QRState {
    url: string;
    ttlSeconds: number;
    timeRemaining: number;
    loading: boolean;
    error: string | null;
}

export function ConnectionDialog() {
    const [open, setOpen] = useState(false);
    const [qrState, setQrState] = useState<QRState>({
        url: '',
        ttlSeconds: 60,
        timeRemaining: 0,
        loading: false,
        error: null,
    });
    const refreshTimeoutRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<number | null>(null);

    const fetchNewToken = useCallback(async () => {
        setQrState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const [tokenData, clientUrl] = await Promise.all([
                fetchQRToken(),
                getClientConnectionUrl(),
            ]);

            const authenticatedUrl = `${clientUrl}?qrToken=${tokenData.qrToken}`;

            setQrState({
                url: authenticatedUrl,
                ttlSeconds: tokenData.ttlSeconds,
                timeRemaining: tokenData.ttlSeconds,
                loading: false,
                error: null,
            });

            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            refreshTimeoutRef.current = window.setTimeout(() => {
                fetchNewToken();
            }, (tokenData.ttlSeconds - 5) * 1000);

        } catch (err) {
            setQrState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to connect to server',
            }));
        }
    }, []);

    useEffect(() => {
        if (open && qrState.timeRemaining > 0) {
            countdownIntervalRef.current = window.setInterval(() => {
                setQrState(prev => ({
                    ...prev,
                    timeRemaining: Math.max(0, prev.timeRemaining - 1),
                }));
            }, 1000);
        }

        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
        };
    }, [open, qrState.url]);

    useEffect(() => {
        if (open) {
            fetchNewToken();
        } else {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = null;
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
        }
    }, [open, fetchNewToken]);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <button className="connection-dialog-trigger" aria-label="Show connection QR Code">
                    <FontAwesomeIcon icon={faQrcode} />
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="radix-dialog-overlay" />
                <Dialog.Content className="radix-dialog-content connection-dialog-content">
                    <Dialog.Title className="radix-dialog-title connection-dialog-title">
                        Connect Device
                    </Dialog.Title>
                    <Dialog.Description className="radix-dialog-description">
                        Scan this QR Code with your device to connect
                    </Dialog.Description>

                    <div className="connection-dialog-qr">
                        {qrState.loading ? (
                            <div className="connection-dialog-loading">Loading...</div>
                        ) : qrState.error ? (
                            <div className="connection-dialog-error">{qrState.error}</div>
                        ) : qrState.url ? (
                            <>
                                <QRCodeSVG
                                    value={qrState.url}
                                    size={200}
                                    bgColor="transparent"
                                    fgColor="#ffffff"
                                    level="M"
                                />
                                <div className="connection-dialog-countdown">
                                    Refreshes in {qrState.timeRemaining}s
                                </div>
                            </>
                        ) : null}
                    </div>

                    <div className="connection-dialog-footer">
                        <span>Built with ❤️ by </span>
                        <a
                            href="https://github.com/devyasminn"
                            onClick={(e) => {
                                e.preventDefault();
                                openUrl("https://github.com/devyasminn");
                            }}
                            className="hover:underline"
                        >
                            Yasmin
                        </a>
                    </div>

                    <Dialog.Close asChild>
                        <button className="connection-dialog-close" aria-label="Close">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
