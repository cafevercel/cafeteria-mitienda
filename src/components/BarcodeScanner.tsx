
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  open: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, open }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [scannerId] = useState(`scanner-${Math.random().toString(36).substr(2, 9)}`);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
  ];

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!open) return;
    
    setIsInitializing(true);
    setError(null);

    try {
      // Small delay to ensure the container is rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          scanner.stop().then(() => {
            onScan(decodedText);
          });
        },
        () => {
          // Failure callback is noisy, ignore
        }
      );
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      if (err.name === 'NotAllowedError') {
        setError("Permiso de cámara denegado. Por favor, habilite el acceso a la cámara.");
      } else if (err.name === 'NotFoundError') {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setError("Error al iniciar el escáner. Asegúrese de que no haya otra aplicación usando la cámara.");
      }
    } finally {
      setIsInitializing(false);
    }
  }, [open, scannerId, onScan]);

  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-500" />
            Escanear Código de Barras
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex flex-col items-center justify-center p-4 min-h-[300px] bg-gray-50 rounded-lg overflow-hidden border">
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
              <p className="text-sm font-medium text-gray-600">Iniciando cámara...</p>
            </div>
          )}

          {error && (
            <div className="w-full space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button 
                onClick={startScanner} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          )}

          <div 
            id={scannerId} 
            className={`w-full max-w-[300px] rounded-lg overflow-hidden ${error ? 'hidden' : 'block'}`}
          />

          {!error && !isInitializing && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 font-medium px-4">
                Coloque el código de barras dentro del recuadro para escanearlo automáticamente.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
