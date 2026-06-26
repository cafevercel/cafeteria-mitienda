import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, Scan, Image as ImageIcon } from "lucide-react";
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
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Formatos más comunes para asegurar velocidad (puedes agregar más si los necesitas)
  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.QR_CODE,
  ];

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Error al detener la cámara", e);
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    await stopScanner();

    try {
      scannerRef.current = new Html5Qrcode("barcode-live-scanner");
      
      await scannerRef.current.start(
        { facingMode: "environment" }, // Deja que el móvil decida la mejor resolución
        {
          fps: 10, // Óptimo para móviles (evita saturar el procesador)
          qrbox: { width: 250, height: 150 }, // CRÍTICO: Guía el enfoque y limita el área de procesamiento
          disableFlip: false,
        },
        (decodedText) => {
          stopScanner();
          onScan(decodedText);
        },
        undefined // Ignoramos advertencias de frames vacíos
      );
    } catch (err) {
      console.error(err);
      setError("No se pudo iniciar la cámara. Verifica los permisos.");
    }
  }, [onScan, stopScanner]);

  // Manejo de la cámara cuando se abre/cierra el Dialog
  useEffect(() => {
    if (open && step === 'camera') {
      // Pequeño retraso para asegurar que el Dialog de shadcn ya está renderizado en el DOM
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }

    return () => { stopScanner(); };
  }, [open, step, startScanner, stopScanner]);

  // Manejo de subida de imagen (Directo y sin recortes manuales)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const html5QrCode = new Html5Qrcode("barcode-live-scanner");
      const decodedText = await html5QrCode.scanFile(file, true);
      onScan(decodedText);
    } catch (err) {
      setError("No se detectó ningún código. Intenta con una foto más clara y cercana.");
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = ''; // Resetear el input
    }
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-orange-600" />
            Escanear Código
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-center font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {/* Contenedor del escáner - Siempre presente pero oculto en modo upload para usar scanFile */}
          <div className={`${step !== 'camera' ? 'hidden' : 'block'} relative rounded-lg overflow-hidden bg-black`}>
            <div id="barcode-live-scanner" className="w-full min-h-[300px]"></div>
          </div>

          {/* Contenido modo Upload */}
          {step === 'upload' && (
            <div className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center bg-orange-50/20">
              {isProcessing ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Procesando imagen...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                  <p className="text-sm text-orange-950 font-bold mb-4">Sube una foto clara del código</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="barcode-upload"
                  />
                  <Button onClick={() => document.getElementById('barcode-upload')?.click()} className="bg-orange-600">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Seleccionar Galería
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Botones de Navegación */}
          <div className="flex gap-2 pt-2">
            {step === 'camera' ? (
              <Button onClick={() => setStep('upload')} variant="outline" className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" /> Subir Foto
              </Button>
            ) : (
              <Button onClick={() => setStep('camera')} variant="outline" className="w-full" disabled={isProcessing}>
                <Camera className="mr-2 h-4 w-4" /> Usar Cámara
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;