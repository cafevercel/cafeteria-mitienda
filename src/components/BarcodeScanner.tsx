import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, Scan, Image as ImageIcon, Lightbulb, LightbulbOff, Terminal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  open: boolean;
}

type Step = 'camera' | 'upload';

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, open }) => {
  const [step, setStep] = useState<Step>('camera');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Estados de Debug ---
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const framesAnalyzed = useRef(0);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 15)); // Guarda los últimos 15 mensajes
  }, []);

  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
  ];

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        addLog("Cámara detenida.");
      } catch (e: any) {
        addLog(`Error deteniendo: ${e.message}`);
      }
    }
  }, [addLog]);

  const toggleTorch = async () => {
    if (scannerRef.current && scannerRef.current.getState() === 2) { // 2 = SCANNING
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: !torchOn }]
        } as any);
        setTorchOn(!torchOn);
        addLog(`Linterna ${!torchOn ? 'ENCENDIDA' : 'APAGADA'}`);
      } catch (e: any) {
        addLog(`Fallo linterna: ${e.message || 'No soportada'}`);
      }
    }
  };

  const startScanner = useCallback(async () => {
    setError(null);
    framesAnalyzed.current = 0;
    await stopScanner();

    try {
      addLog("Iniciando instancia Html5Qrcode...");
      scannerRef.current = new Html5Qrcode("barcode-live-scanner", {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      } as any);

      addLog("Solicitando cámara trasera...");

      // 2. Dejamos el start() solo con fps y qrbox
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 120 },
        },
        (decodedText) => {
          addLog(`¡CÓDIGO DETECTADO!: ${decodedText}`);
          stopScanner();
          onScan(decodedText);
        },
        (errorMessage) => {
          // Este callback se dispara por cada frame que falla (10 veces por segundo).
          // No imprimimos el error real porque saturaría la pantalla, pero contamos los frames.
          framesAnalyzed.current++;

          if (framesAnalyzed.current === 1) {
            addLog("Video en vivo: Análisis iniciado correctamente.");

            // Intentar detectar si hay linterna
            try {
              const capabilities = scannerRef.current?.getRunningTrackCameraCapabilities();
              if (capabilities && (capabilities as any).torchFeature()) {
                setHasTorch(true);
                addLog("Característica de linterna detectada.");
              }
            } catch (e) { }
          }

          if (framesAnalyzed.current % 50 === 0) {
            addLog(`Buscando... (${framesAnalyzed.current} frames analizados)`);
          }
        }
      );
    } catch (err: any) {
      addLog(`ERROR CRÍTICO: ${err.message || err}`);
      setError("No se pudo iniciar la cámara.");
    }
  }, [onScan, stopScanner, addLog]);

  useEffect(() => {
    if (open && step === 'camera') {
      const timer = setTimeout(() => startScanner(), 500);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  }, [open, step, startScanner, stopScanner]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    addLog(`Analizando archivo subido: ${file.name}`);

    try {
      const scanner = new Html5Qrcode("barcode-live-scanner");
      const decodedText = await scanner.scanFile(file, true);
      addLog(`¡CÓDIGO DETECTADO en imagen!: ${decodedText}`);
      onScan(decodedText);
    } catch (err) {
      addLog("Fallo al detectar código en la imagen.");
      setError("No se detectó ningún código. Asegúrate de que la imagen sea nítida.");
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-orange-600" />
              Escanear Código
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="h-8">
              <Terminal className="w-4 h-4 text-gray-500" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-center font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {/* Área del Escáner */}
          <div className={`${step !== 'camera' ? 'hidden' : 'block'} relative rounded-lg overflow-hidden bg-black`}>
            <div id="barcode-live-scanner" className="w-full min-h-[250px]"></div>

            {/* Controles sobre la cámara */}
            <div className="absolute bottom-2 right-2 z-10">
              <Button
                variant="secondary"
                size="icon"
                className="bg-white/80 hover:bg-white text-black rounded-full"
                onClick={toggleTorch}
              >
                {torchOn ? <LightbulbOff className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* CONSOLA DE DEBUG (Visible en el móvil) */}
          {showDebug && (
            <div className="bg-slate-950 text-emerald-400 p-3 rounded-lg font-mono text-[10px] h-32 overflow-y-auto shadow-inner border border-slate-800">
              <div className="text-slate-400 mb-1 border-b border-slate-800 pb-1 flex justify-between">
                <span>--- SYSTEM LOGS ---</span>
                <span>{step === 'camera' ? '🔴 EN VIVO' : '📂 ARCHIVO'}</span>
              </div>
              {debugLogs.map((log, i) => (
                <div key={i} className="break-all whitespace-pre-wrap">{log}</div>
              ))}
              {debugLogs.length === 0 && <div className="text-slate-600">Esperando eventos...</div>}
            </div>
          )}

          {/* Upload UI */}
          {step === 'upload' && (
            <div className="border-2 border-dashed border-orange-200 rounded-xl p-6 text-center bg-orange-50/20">
              {isProcessing ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Procesando imagen...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                  <p className="text-sm text-orange-950 font-bold mb-4">Sube una foto clara del código</p>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="barcode-upload" />
                  <Button onClick={() => document.getElementById('barcode-upload')?.click()} className="bg-orange-600">
                    <ImageIcon className="mr-2 h-4 w-4" /> Seleccionar Galería
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Navegación */}
          <div className="flex gap-2">
            {step === 'camera' ? (
              <Button onClick={() => setStep('upload')} variant="outline" className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" /> Modo Galería
              </Button>
            ) : (
              <Button onClick={() => setStep('camera')} variant="outline" className="w-full" disabled={isProcessing}>
                <Camera className="mr-2 h-4 w-4" /> Modo Cámara
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;