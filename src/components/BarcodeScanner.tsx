import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, Scan, Image as ImageIcon, Lightbulb, LightbulbOff } from "lucide-react";
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
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e: any) {
        // Silencioso
      }
    }
  }, []);

  const toggleTorch = async () => {
    if (scannerRef.current && scannerRef.current.getState() === 2) { // 2 = SCANNING
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: !torchOn }]
        } as any);
        setTorchOn(!torchOn);
      } catch (e: any) {
        // Linterna no disponible
      }
    }
  };

  const startScanner = useCallback(async () => {
    setError(null);
    await stopScanner();

    try {
      scannerRef.current = new Html5Qrcode("barcode-live-scanner", {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]
      });

      // Priorizar cámara trasera principal de móvil
      let cameraConfig: string | { facingMode: string } = { facingMode: "environment" };

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCameras = cameras.filter(c => /back|trasera|rear/i.test(c.label));
          let selectedCam;

          if (backCameras.length > 0) {
            // Evitar ultra gran angular (0.5x) para facilitar enfoque de códigos de barras
            selectedCam = backCameras.find(c => !/ultra/i.test(c.label) && !/0\.5/i.test(c.label)) || backCameras[0];
          } else if (cameras.length > 1) {
            selectedCam = cameras.find(c => !/ultra/i.test(c.label)) || cameras[cameras.length - 1];
          } else {
            selectedCam = cameras[0];
          }

          if (selectedCam) {
            cameraConfig = selectedCam.id;
          }
        }
      } catch (camErr) {
        // Fallback a facingMode environment si falla listado
      }

      await scannerRef.current.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: 260, height: 140 },
        },
        (decodedText) => {
          stopScanner();
          onScan(decodedText);
        },
        () => {
          // Callback por frame no detectado (mantener limpio)
        }
      );

      // Comprobar linterna
      try {
        const capabilities = scannerRef.current?.getRunningTrackCameraCapabilities();
        if (capabilities && (capabilities as any).torchFeature()) {
          setHasTorch(true);
        }
      } catch (e) { }

    } catch (err: any) {
      setError("No se pudo acceder a la cámara. Por favor permite los permisos de cámara.");
    }
  }, [onScan, stopScanner]);

  useEffect(() => {
    if (open && step === 'camera') {
      const timer = setTimeout(() => startScanner(), 300);
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

    try {
      const scanner = new Html5Qrcode("barcode-live-scanner");
      const decodedText = await scanner.scanFile(file, true);
      onScan(decodedText);
    } catch (err) {
      setError("No se detectó ningún código de barras en la imagen. Asegúrate de que sea clara y bien enfocada.");
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
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-orange-600" />
            Escanear Código de Barras
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

            {/* Controles de linterna si está disponible */}
            {hasTorch && (
              <div className="absolute bottom-3 right-3 z-10">
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-white/80 hover:bg-white text-black rounded-full shadow"
                  onClick={toggleTorch}
                >
                  {torchOn ? <LightbulbOff className="w-5 h-5" /> : <Lightbulb className="w-5 h-5 text-amber-500" />}
                </Button>
              </div>
            )}
          </div>

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
                  <p className="text-sm text-orange-950 font-bold mb-4">Sube una foto clara del código de barras</p>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="barcode-upload" />
                  <Button onClick={() => document.getElementById('barcode-upload')?.click()} className="bg-orange-600">
                    <ImageIcon className="mr-2 h-4 w-4" /> Seleccionar Galería
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Navegación entre cámara y archivo */}
          <div className="flex gap-2">
            {step === 'camera' ? (
              <Button onClick={() => setStep('upload')} variant="outline" className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" /> Escanear desde Imagen / Galería
              </Button>
            ) : (
              <Button onClick={() => setStep('camera')} variant="outline" className="w-full" disabled={isProcessing}>
                <Camera className="mr-2 h-4 w-4" /> Usar Cámara en Vivo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;