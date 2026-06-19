import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, Upload, RotateCcw, Check, Image as ImageIcon, Scan } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactCrop, { Crop, PixelCrop, PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  open: boolean;
  initialStep?: 'camera' | 'crop' | 'scanning' | 'upload';
}

type Step = 'camera' | 'crop' | 'scanning' | 'upload';

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, open, initialStep }) => {
  const [step, setStep] = useState<Step>('camera');
  const [isPortrait, setIsPortrait] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [croppedImagePixels, setCroppedImagePixels] = useState<PixelCrop | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkOrientation = () => {
        setIsPortrait(window.innerHeight > window.innerWidth);
      };
      checkOrientation();
      window.addEventListener('resize', checkOrientation);
      return () => window.removeEventListener('resize', checkOrientation);
    }
  }, []);

  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.AZTEC,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.RSS_14,
    Html5QrcodeSupportedFormats.RSS_EXPANDED,
  ];

  // Stop live scanning
  const stopLiveScanning = useCallback(async () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          console.error("Error stopping live scanner:", e);
        }
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  // Start live scanning
  const startLiveScanning = useCallback(async () => {
    await stopLiveScanning();
    setCameraError(null);
    setScanError(null);

    // Esperar a que el elemento DOM con id "barcode-live-scanner" esté montado
    setTimeout(async () => {
      const element = document.getElementById("barcode-live-scanner");
      if (!element) {
        console.error("Scanner element not found in DOM");
        return;
      }

      try {
        const html5QrCode = new Html5Qrcode("barcode-live-scanner", {
          formatsToSupport: formats,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        html5QrCodeRef.current = html5QrCode;

        const qrCodeSuccessCallback = (decodedText: string) => {
          onScan(decodedText);
          stopLiveScanning().catch(console.error);
          handleClose();
        };

        const config = {
          fps: 20,
          aspectRatio: isPortrait ? 0.75 : 1.333333
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          () => {} // Ignorar advertencias silenciosas
        );
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError("No se pudo acceder a la cámara trasera. Asegúrese de otorgar permisos o use la opción de subir imagen.");
      }
    }, 150);
  }, [onScan, stopLiveScanning, isPortrait]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCapturedImage(result);
      setStep('crop');
    };
    reader.readAsDataURL(file);
  };

  // Get cropped image
  const getCroppedImage = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!imgRef.current || !croppedImagePixels || !capturedImage) {
        resolve(null);
        return;
      }

      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const sourceWidth = croppedImagePixels.width * scaleX;
      const sourceHeight = croppedImagePixels.height * scaleY;
      
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        resolve(null);
        return;
      }

      // Upscaling
      const targetWidth = Math.max(1000, sourceWidth);
      const targetHeight = (sourceHeight / sourceWidth) * targetWidth;

      // Quiet Zone
      const padding = targetWidth * 0.1;
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth + (padding * 2);
      canvas.height = targetHeight + (padding * 2);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Contrast + Grayscale
      ctx.filter = 'contrast(1.5) brightness(1.05) saturate(0%)';

      ctx.drawImage(
        image,
        croppedImagePixels.x * scaleX,
        croppedImagePixels.y * scaleY,
        sourceWidth,
        sourceHeight,
        padding,
        padding,
        targetWidth,
        targetHeight
      );
      
      resolve(canvas.toDataURL('image/png'));
    });
  }, [croppedImagePixels, capturedImage]);

  // Scan cropped image
  const scanBarcode = async () => {
    setIsScanning(true);
    setScanError(null);
    setStep('scanning');

    try {
      const cropped = await getCroppedImage();
      if (!cropped) {
        setScanError("No se pudo procesar la imagen recortada.");
        setIsScanning(false);
        return;
      }

      const response = await fetch(cropped);
      const blob = await response.blob();
      const file = new File([blob], 'barcode.png', { type: 'image/png' });

      const scanner = new Html5Qrcode('barcode-scan-area', {
        formatsToSupport: formats,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      const decodedText = await scanner.scanFile(file, true);
      onScan(decodedText);
      handleClose();
    } catch (err: any) {
      console.error("Scan error:", err);
      setScanError("No se detectó ningún código de barras en el área de recorte. Intente recortar más de cerca y que la imagen sea nítida.");
      setIsScanning(false);
    }
  };

  const resetToCamera = useCallback(() => {
    setCapturedImage(null);
    setCrop(undefined);
    setCroppedImagePixels(null);
    setScanError(null);
    setIsScanning(false);
    setStep(initialStep || 'camera');
  }, [initialStep]);

  // Start live scanning when opening on camera step
  useEffect(() => {
    if (open && step === 'camera') {
      startLiveScanning();
    } else {
      stopLiveScanning();
    }
    return () => {
      stopLiveScanning();
    };
  }, [open, step, startLiveScanning, stopLiveScanning]);

  // Cleanup on open/close changes
  useEffect(() => {
    if (open) {
      setStep(initialStep || 'camera');
    } else {
      resetToCamera();
    }
  }, [open, initialStep, resetToCamera]);

  const handleClose = () => {
    stopLiveScanning();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-orange-600 animate-pulse" />
            Escanear Código de Barras
          </DialogTitle>
        </DialogHeader>

        {/* STEP: Camera (LIVE STREAM) */}
        {step === 'camera' && (
          <div className="space-y-4">
            {cameraError ? (
              <Alert variant="destructive">
                <AlertDescription className="text-center font-medium">{cameraError}</AlertDescription>
              </Alert>
            ) : (
              <div 
                className="relative bg-black rounded-lg overflow-hidden border border-gray-800 w-full" 
                style={{ aspectRatio: isPortrait ? '3/4' : '4/3' }}
              >
                {/* HTML5 QR Code Mount point */}
                <div id="barcode-live-scanner" className="w-full h-full object-cover"></div>
                
                {/* Visual Target Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="border-2 border-dashed border-orange-500 rounded-lg w-[85%] h-[40%] flex items-center justify-center">
                    <div className="w-full h-[2px] bg-red-500 animate-bounce"></div>
                  </div>
                </div>

                <style>{`
                  #barcode-live-scanner {
                    width: 100% !important;
                    height: 100% !important;
                  }
                  #barcode-live-scanner video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                  }
                `}</style>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('upload')}
                variant="outline"
                className="w-full border-orange-200 text-orange-950 font-bold hover:bg-orange-50"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Subir Foto desde Galería
              </Button>
            </div>

            {!cameraError && (
              <p className="text-xs text-gray-500 text-center font-medium">
                Apunte su cámara directamente al código de barras. Se detectará automáticamente.
              </p>
            )}
          </div>
        )}

        {/* STEP: Crop */}
        {step === 'crop' && capturedImage && (
          <div className="space-y-4">
            <div className="max-h-[400px] overflow-hidden flex justify-center bg-black/5 rounded-lg border">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCroppedImagePixels(c)}
              >
                <img
                  ref={imgRef}
                  src={capturedImage}
                  alt="Captured"
                  className="max-w-full max-h-[350px] object-contain"
                />
              </ReactCrop>
            </div>

            <p className="text-xs text-gray-500 text-center font-medium">
              Ajusta el recuadro para seleccionar solo el área del código de barras.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={scanBarcode}
                disabled={!crop}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                <Check className="mr-2 h-4 w-4" />
                Procesar y Escanear
              </Button>
              <Button
                onClick={resetToCamera}
                variant="outline"
                className="border-gray-300 font-bold"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Scanning */}
        {step === 'scanning' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6">
              {isScanning && (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 text-orange-600 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Procesando y descodificando...</p>
                </div>
              )}
              
              <div 
                id="barcode-scan-area" 
                className={`w-full max-w-[300px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 overflow-hidden ${!isScanning && !scanError ? 'hidden' : ''}`}
                style={{ minHeight: '150px' }}
              />

              {scanError && (
                <div className="mt-4 w-full">
                  <Alert variant="destructive">
                    <AlertDescription className="text-center font-medium">{scanError}</AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isScanning && (
                <Button
                  onClick={() => setStep('upload')}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Intentar Otra Foto
                </Button>
              )}
              <Button
                onClick={resetToCamera}
                variant="outline"
                className={`font-bold ${isScanning ? "w-full" : ""}`}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Volver al Scanner en Vivo
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center bg-orange-50/20">
              <Upload className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <p className="text-sm text-orange-950 font-bold mb-1">
                Subir Imagen de Código de Barras
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Soporta capturas, fotos y formatos JPG/PNG
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="barcode-upload-input"
              />
              <Button
                onClick={() => document.getElementById('barcode-upload-input')?.click()}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Seleccionar Imagen
              </Button>
            </div>

            <Button
              onClick={() => setStep('camera')}
              variant="outline"
              className="w-full border-orange-200 text-orange-950 font-bold hover:bg-orange-50"
            >
              <Camera className="mr-2 h-4 w-4" />
              Volver al Escáner en Vivo
            </Button>
          </div>
        )}

        <div className="flex justify-end mt-2 pt-2 border-t">
          <Button variant="ghost" onClick={handleClose} className="text-gray-500 font-medium">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
