
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface BarcodeDisplayProps {
  value: string;
  name: string;
}

const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({ value, name }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: "CODE128",
          lineColor: "#000",
          width: 2.5,
          height: 70,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        });
      } catch (err) {
        console.error("Error generating barcode:", err);
      }
    }
  }, [value]);

  const downloadBarcode = () => {
    if (!barcodeRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = document.createElement('img');
    
    const paddingX = 40;
    const svgRect = barcodeRef.current.getBBox();
    const titleSpace = 40; // Space allocated for product name
    const footerSpace = 45; // Space allocated for footer text
    const paddingY = 20;   // Top/bottom margins
    
    canvas.width = Math.max(svgRect.width + paddingX * 2, 350); // Ensure a minimum width for long titles
    const barcodeWidth = svgRect.width;
    const barcodeHeight = svgRect.height;
    
    canvas.height = barcodeHeight + titleSpace + footerSpace + paddingY * 2;

    img.onload = () => {
      // Draw background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw product name (centered, above barcode)
      ctx.fillStyle = "#000000";
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, canvas.width / 2, paddingY + titleSpace / 2);
      
      // Draw Barcode image in the middle (centered horizontally)
      const barcodeX = (canvas.width - barcodeWidth) / 2;
      const barcodeY = paddingY + titleSpace;
      ctx.drawImage(img, barcodeX, barcodeY);
      
      // Draw "Multimarcas S.U.R.L" (centered, below barcode)
      ctx.fillStyle = "#555555"; // slightly muted gray
      ctx.font = "14px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Multimarcas S.U.R.L", canvas.width / 2, barcodeY + barcodeHeight + footerSpace / 2);
      
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `barcode-${name.replace(/\s+/g, '-').toLowerCase()}-${value}.png`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const printBarcode = () => {
    if (!barcodeRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Código de Barras - ${name}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
            .container { text-align: center; border: 1px solid #eee; padding: 20px; border-radius: 8px; }
            h2 { margin: 0 0 20px 0; color: #333; font-size: 22px; }
            .footer { margin-top: 20px; font-weight: bold; color: #555; font-size: 16px; }
            svg { max-width: 100%; height: auto; }
            @media print {
              .no-print { display: none; }
              body { height: auto; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${name}</h2>
            ${svgData}
            <div class="footer">Multimarcas S.U.R.L</div>
            <div class="no-print" style="margin-top: 20px;">
              <button onclick="window.print()">Imprimir</button>
              <button onclick="window.close()">Cerrar</button>
            </div>
          </div>
          <script>
            window.onload = () => {
                setTimeout(() => {
                    // window.print();
                }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white border border-gray-100 rounded-xl shadow-sm transition-all hover:shadow-md">
      <div className="bg-white p-2 mb-6 rounded-lg overflow-x-auto max-w-full">
        <svg ref={barcodeRef} viewBox="0 0 300 120" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
      
      <div className="grid grid-cols-2 gap-3 w-full">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={downloadBarcode} 
          className="w-full flex items-center justify-center gap-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-medium"
        >
          <Download className="w-4 h-4" />
          PNG
        </Button>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={printBarcode} 
          className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
};

export default BarcodeDisplay;
