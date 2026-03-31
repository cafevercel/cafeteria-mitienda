
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, Upload, RotateCcw, Check, Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactCrop, { Crop, PixelCrop, PercentCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  open: boolean;
}

type Step = 'camera' | 'crop' | 'scanning' | 'upload';

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, open }) => {
  const [step, setStep] = useState<Step>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [croppedImagePixels, setCroppedImagePixels] = useState<PixelCrop | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
  ];

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError') {
        setCameraError("Permiso de cámara denegado. Por favor, habilite el acceso a la cámara.");
      } else if (err.name === 'NotFoundError') {
        setCameraError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setCameraError("Error al acceder a la cámara.");
      }
    }
  }, [stopCamera]);

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setStep('crop');
  };

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
      const { width, height, x, y } = croppedImagePixels;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
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

      // Convert base64 to Blob for Html5Qrcode
      const response = await fetch(cropped);
      const blob = await response.blob();
      const file = new File([blob], 'barcode.jpg', { type: 'image/jpeg' });

      const scanner = new Html5Qrcode('barcode-scan-area');
      const decodedText = await scanner.scanFile(file, false);

      // Success - get result and close
      onScan(decodedText);
      handleClose();
    } catch (err: any) {
      console.error("Scan error:", err);
      setScanError("No se detectó ningún código de barras. Intente de nuevo.");
      setIsScanning(false);
    }
  };

  // Reset to camera
  const resetToCamera = () => {
    setCapturedImage(null);
    setCroppedImage(null);
    setCrop(undefined);
    setCroppedImagePixels(null);
    setScanError(null);
    setIsScanning(false);
    setStep('camera');
  };

  // Handle crop change
  const onCropChange = (c: Crop) => setCrop(c);

  // Handle crop complete
  const onCropComplete = (pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    setCroppedImagePixels(pixelCrop);
  };

  // Start camera when opening on camera/upload step
  useEffect(() => {
    if (open && (step === 'camera')) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, step, startCamera, stopCamera]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      resetToCamera();
    }
  }, [open]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-500" />
            Escanear Código de Barras
          </DialogTitle>
        </DialogHeader>

        {/* STEP: Camera */}
        {step === 'camera' && (
          <div className="space-y-4">
            {cameraError ? (
              <Alert variant="destructive">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={capturePhoto}
                disabled={!!cameraError}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capturar
              </Button>
              <Button
                onClick={() => setStep('upload')}
                variant="outline"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Subir
              </Button>
            </div>

            {!cameraError && (
              <p className="text-xs text-gray-500 text-center">
                Apunte la cámara al código de barras y presione Capturar
              </p>
            )}
          </div>
        )}

        {/* STEP: Crop */}
        {step === 'crop' && capturedImage && (
          <div className="space-y-4">
            <div className="max-h-[400px] overflow-hidden">
              <ReactCrop
                crop={crop}
                onChange={onCropChange}
                onComplete={onCropComplete}
                aspect={undefined}
              >
                <img
                  ref={imgRef}
                  src={capturedImage}
                  alt="Captured"
                  className="max-w-full"
                />
              </ReactCrop>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Seleccione el área del código de barras
            </p>

            <div className="flex gap-2">
              <Button
                onClick={scanBarcode}
                disabled={!crop}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Escanear
              </Button>
              <Button
                onClick={resetToCamera}
                variant="outline"
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
            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-gray-600">Escaneando...</p>
              </div>
            ) : (
              <>
                <div id="barcode-scan-area" className="flex justify-center" />
                {scanError && (
                  <Alert variant="destructive">
                    <AlertDescription>{scanError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={scanBarcode}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Loader2 className="mr-2 h-4 w-4" />
                    Reintentar
                  </Button>
                  <Button
                    onClick={resetToCamera}
                    variant="outline"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Seleccione una imagen con código de barras
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Elegir Imagen
              </Button>
            </div>

            <Button
              onClick={() => setStep('camera')}
              variant="outline"
              className="w-full"
            >
              <Camera className="mr-2 h-4 w-4" />
              Usar Cámara
            </Button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
