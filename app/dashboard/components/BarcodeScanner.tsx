'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualInput, setManualInput] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        startScanner();
        return () => {
            stopScanner();
        };
    }, []);

    const startScanner = async () => {
        try {
            const html5QrCode = new Html5Qrcode('barcode-reader');
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                },
                (decodedText) => {
                    onScan(decodedText);
                    stopScanner();
                },
                () => { }
            );
            setIsScanning(true);
            setError(null);
        } catch (err) {
            console.error('Scanner error:', err);
            setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้อง หรือพิมพ์ Barcode ด้านล่าง');
            setIsScanning(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current = null;
            } catch (e) {
                console.error('Stop scanner error:', e);
            }
        }
        setIsScanning(false);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualInput.trim()) {
            onScan(manualInput.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">📱 สแกน Barcode</h3>
                    <button
                        onClick={() => {
                            stopScanner();
                            onClose();
                        }}
                        className="text-slate-400 hover:text-white text-2xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="p-4">
                    <div
                        id="barcode-reader"
                        className="w-full aspect-video bg-slate-900 rounded-lg overflow-hidden mb-4"
                    />

                    {isScanning && (
                        <div className="text-center text-emerald-400 text-sm mb-4 animate-pulse">
                            🔍 กำลังสแกน... หันกล้องไปที่ Barcode
                        </div>
                    )}

                    {error && (
                        <div className="text-amber-400 text-sm mb-4 text-center p-3 bg-amber-500/10 rounded-lg">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Manual Input */}
                    <form onSubmit={handleManualSubmit} className="space-y-3">
                        <div>
                            <label className="block text-slate-400 text-sm mb-1">
                                หรือพิมพ์ Barcode/SKU:
                            </label>
                            <input
                                type="text"
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                placeholder="กรอก Barcode หรือ SKU"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg"
                                autoFocus={!!error}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    stopScanner();
                                    onClose();
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={!manualInput.trim()}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold"
                            >
                                ค้นหา
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
