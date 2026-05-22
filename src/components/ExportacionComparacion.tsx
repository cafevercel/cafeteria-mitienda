'use client';

import React, { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Info,
  Search,
  PackageCheck,
  TrendingDown,
  CheckCircle2,
  XCircle,
  FileDown
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Vendedor, Producto } from '@/types';
import * as XLSX from 'xlsx';
import { getVendedorProductos } from '@/app/services/api';
import { toast } from "@/hooks/use-toast";

interface ExportacionComparacionProps {
  vendedores: Vendedor[];
  almacen: Producto[];
}

interface ComparisonItem {
  codigo: string;
  productoNombre: string;
  cantidadWeb: number;
  cantidadPDF: number;
  diferencia: number;
  precioCompra: number;
  impactoFinanciero: number;
}

interface PDFRow {
  codigo: string;
  cantidad: number;
}

export default function ExportacionComparacion({ vendedores, almacen }: ExportacionComparacionProps) {
  const [activeTab, setActiveTab] = useState('exportacion');
  
  // Estados para Exportación
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [includeAlmacen, setIncludeAlmacen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Estados para Comparación
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareStep, setCompareStep] = useState(1);
  const [pdfData, setPdfData] = useState<PDFRow[]>([]);
  const [isParsingPDF, setIsParsingPDF] = useState(false);
  const [compareVendors, setCompareVendors] = useState<string[]>([]);
  const [compareIncludeAlmacen, setCompareIncludeAlmacen] = useState(true);
  const [comparisonResults, setComparisonResults] = useState<ComparisonItem[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auxiliar para calcular cantidad total de un producto considerando sus parámetros
  const getProductTotalQty = (prod: Producto) => {
    if (prod.tiene_parametros && prod.parametros) {
      return prod.parametros.reduce((sum, param) => sum + param.cantidad, 0);
    }
    return prod.cantidad || 0;
  };

  // Alterna selección individual de vendedores en la exportación
  const handleToggleVendor = (id: string) => {
    setSelectedVendors(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleToggleAllVendors = () => {
    if (selectedVendors.length === vendedores.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendedores.map(v => v.id));
    }
  };

  // Genera reporte consolidado Excel
  const handleExport = async () => {
    if (selectedVendors.length === 0 && !includeAlmacen) {
      toast({
        title: "Error",
        description: "Selecciona al menos una fuente para exportar",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    try {
      const allData: any[] = [];
      const processedBarcodes = new Set<string>();

      // Función auxiliar para agregar producto
      const addProductToExport = (prod: Producto, sourceName: string) => {
        const barcode = prod.codigo_barras?.trim() || '';
        if (!barcode) return; // Omitir productos sin código de barras

        const key = `${barcode}_${sourceName}`;
        if (processedBarcodes.has(key)) return;
        processedBarcodes.add(key);

        const totalQty = getProductTotalQty(prod);

        allData.push({
          'Código': barcode,
          'Producto': prod.nombre,
          'Fuente': sourceName,
          'Cantidad': totalQty,
          'Precio Compra': prod.precio_compra || 0,
          'Precio Venta': prod.precio || 0,
          'Sección': prod.seccion || 'Sin Sección'
        });
      };

      // 1. Procesar existencias del Almacén Central
      if (includeAlmacen) {
        almacen.forEach(prod => {
          addProductToExport(prod, 'Almacén Central');
        });
      }

      // 2. Procesar existencias de los Vendedores
      for (const vendorId of selectedVendors) {
        const vendor = vendedores.find(v => v.id === vendorId);
        if (!vendor) continue;
        try {
          const vendorProducts = await getVendedorProductos(vendorId);
          vendorProducts.forEach((prod: Producto) => {
            addProductToExport(prod, vendor.nombre);
          });
        } catch (error) {
          console.error(`Error al obtener productos del vendedor ${vendor.nombre}:`, error);
        }
      }

      if (allData.length === 0) {
        toast({
          title: "Aviso",
          description: "No se encontraron productos con código de barras en las fuentes seleccionadas.",
          variant: "destructive"
        });
        setIsExporting(false);
        return;
      }

      // 3. Crear hoja Excel
      const ws = XLSX.utils.json_to_sheet(allData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventario Consolidado");
      
      // Ajustar anchos
      ws['!cols'] = [
        { wch: 20 }, // Código
        { wch: 35 }, // Producto
        { wch: 20 }, // Fuente
        { wch: 10 }, // Cantidad
        { wch: 15 }, // Precio Compra
        { wch: 15 }, // Precio Venta
        { wch: 15 }  // Sección
      ];

      XLSX.writeFile(wb, `Inventario_Consolidado_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setShowExportDialog(false);
      toast({ title: "Éxito", description: "Exportación completada correctamente" });
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast({ title: "Error", description: "No se pudo realizar la exportación", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Maneja la carga de archivos PDF en el cliente y ejecuta el Parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({ title: "Error", description: "Por favor, sube un archivo PDF válido", variant: "destructive" });
      return;
    }

    setIsParsingPDF(true);
    try {
      // Inyección del Polyfill para compatibilidad con Promise.withResolvers en pdfjs
      if (typeof Promise.withResolvers === 'undefined') {
          (Promise as any).withResolvers = function() {
              let resolve, reject;
              const promise = new Promise((res, rej) => {
                  resolve = res;
                  reject = rej;
              });
              return { promise, resolve, reject };
          };
      }
      
      // Importación dinámica para prevenir errores en el servidor durante build de Next.js
      const pdfjs = await import('pdfjs-dist');
      // @ts-ignore
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = "";

      // Lectura por lotes e hilado de textos planos
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || "")
          .join(" ");
        fullText += pageText + "\n";
      }

      const rows: PDFRow[] = [];
      
      // Regex 1: Formato con puntos específico (ej. 123.456.78901)
      const productRegexDotted = /(\d{3}\.\d{3}\.\d{5})\s+(.*?)\s+U\s+(\d+(?:\.\d+)?)/g;
      
      let match;
      while ((match = productRegexDotted.exec(fullText)) !== null) {
        rows.push({
          codigo: match[1],
          cantidad: parseFloat(match[3])
        });
      }

      // Regex 2: Formato numérico continuo estándar de 8 a 14 dígitos (ej. EAN-13, UPC)
      if (rows.length === 0) {
        const productRegexNumeric = /\b(\d{8,14})\b\s+(.*?)\s+(?:U\s+)?(\d+(?:\.\d+)?)/g;
        while ((match = productRegexNumeric.exec(fullText)) !== null) {
          rows.push({
            codigo: match[1],
            cantidad: parseFloat(match[3])
          });
        }
      }

      // Fallback: Línea por línea con regex flexible
      if (rows.length === 0) {
        const lines = fullText.split('\n');
        lines.forEach(line => {
           // Buscar dotted
           const dottedMatch = line.match(/(\d{3}\.\d{3}\.\d{5})\s+.*?\s+(?:U\s+)?(\d+(?:\.\d+)?)/);
           if (dottedMatch) {
             rows.push({ codigo: dottedMatch[1], cantidad: parseFloat(dottedMatch[2]) });
             return;
           }

           // Buscar numérico continuo (8-14 dígitos)
           const numericMatch = line.match(/\b(\d{8,14})\b.*?\s+(?:U\s+)?(\d+(?:\.\d+)?)/);
           if (numericMatch) {
             rows.push({ codigo: numericMatch[1], cantidad: parseFloat(numericMatch[2]) });
           }
        });
      }

      if (rows.length === 0) {
        toast({ 
          title: "Aviso", 
          description: "No se detectaron productos con códigos estructurados en el PDF. Asegúrate de que el documento tenga los códigos de barra correspondientes.", 
          variant: "destructive" 
        });
      } else {
        setPdfData(rows);
        setCompareStep(2); // Avanza al siguiente paso del asistente
        toast({ title: "PDF Procesado", description: `Se detectaron ${rows.length} códigos de barras en el documento.` });
      }
    } catch (error: any) {
      console.error("Error al parsear el archivo PDF:", error);
      toast({ title: "Error", description: `Error al procesar: ${error.message || "Error desconocido"}`, variant: "destructive" });
    } finally {
      setIsParsingPDF(false);
      if (e.target) e.target.value = ''; // Resetea el input file
    }
  };

  // Cruza datos del PDF contra los inventarios seleccionados (Almacén y/o Vendedores)
  const handleStartComparison = async () => {
    if (compareVendors.length === 0 && !compareIncludeAlmacen) {
      toast({ title: "Error", description: "Selecciona al menos una fuente para la comparativa", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    try {
      // Mapa consolidado de inventario del sistema
      const webInventory: Record<string, { nombre: string, cantidad: number, precioCompra: number }> = {};

      const registerSystemProduct = (prod: Producto) => {
        const code = prod.codigo_barras?.trim() || '';
        if (!code) return;

        const totalQty = getProductTotalQty(prod);

        if (!webInventory[code]) {
          webInventory[code] = { 
            nombre: prod.nombre, 
            cantidad: 0, 
            precioCompra: prod.precio_compra || 0 
          };
        }
        webInventory[code].cantidad += totalQty;
      };

      // 1. Agrupar existencias del Almacén Central
      if (compareIncludeAlmacen) {
        almacen.forEach(prod => {
          registerSystemProduct(prod);
        });
      }

      // 2. Agrupar existencias de los Vendedores seleccionados
      for (const vId of compareVendors) {
        try {
          const vProducts = await getVendedorProductos(vId);
          vProducts.forEach((prod: Producto) => {
            registerSystemProduct(prod);
          });
        } catch (err) {
          console.error(`Error al obtener productos del vendedor ${vId}:`, err);
        }
      }

      // 3. Cruzar datos e identificar discrepancias
      const results: ComparisonItem[] = [];
      
      // Agrupar filas del PDF en caso de que un código aparezca varias veces
      const pdfInventory: Record<string, number> = {};
      pdfData.forEach(row => {
        const code = row.codigo.trim();
        pdfInventory[code] = (pdfInventory[code] || 0) + row.cantidad;
      });

      // Iterar por todo el inventario consolidado del PDF
      Object.entries(pdfInventory).forEach(([codigo, cantPDF]) => {
        const webItem = webInventory[codigo];
        const cantWeb = webItem ? webItem.cantidad : 0;
        const nombre = webItem ? webItem.nombre : "No encontrado en base de datos";
        const pCompra = webItem ? webItem.precioCompra : 0;
        const diff = cantWeb - cantPDF;
        
        results.push({
          codigo,
          productoNombre: nombre,
          cantidadWeb: cantWeb,
          cantidadPDF: cantPDF,
          diferencia: diff,
          precioCompra: pCompra,
          impactoFinanciero: diff * pCompra
        });
      });

      // Cruzar de reversa: productos en la web con código que NO estaban en el PDF
      Object.entries(webInventory).forEach(([codigo, webItem]) => {
        if (pdfInventory[codigo] === undefined) {
          // El producto existe en el sistema web pero el PDF reportó 0 unidades
          const diff = webItem.cantidad;
          results.push({
            codigo,
            productoNombre: webItem.nombre,
            cantidadWeb: webItem.cantidad,
            cantidadPDF: 0,
            diferencia: diff,
            precioCompra: webItem.precioCompra,
            impactoFinanciero: diff * webItem.precioCompra
          });
        }
      });

      // Ordenar resultados: primero las diferencias más grandes en valor absoluto
      results.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

      setComparisonResults(results);
      setShowCompareDialog(false);
      setCompareStep(1);
      setPdfData([]);
      toast({ title: "Éxito", description: "Comparación calculada correctamente" });
    } catch (error) {
      console.error("Error al procesar la comparación:", error);
      toast({ title: "Error", description: "Error al cruzar datos", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Exporta los resultados finales de la grilla comparativa
  const exportComparisonToExcel = () => {
    const data = comparisonResults.map(item => ({
      'Código de Barras': item.codigo,
      'Producto': item.productoNombre,
      'Precio de Compra': item.precioCompra,
      'Cantidad en Sistema (Web)': item.cantidadWeb,
      'Cantidad Contabilizada (PDF)': item.cantidadPDF,
      'Diferencia (Varianza)': item.diferencia,
      'Impacto Financiero': item.impactoFinanciero
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparación de Inventario");
    
    ws['!cols'] = [
      { wch: 20 }, // Código
      { wch: 35 }, // Producto
      { wch: 18 }, // Precio Compra
      { wch: 22 }, // Cantidad Web
      { wch: 22 }, // Cantidad PDF
      { wch: 20 }, // Varianza
      { wch: 20 }  // Impacto
    ];

    XLSX.writeFile(wb, `Reporte_Comparativa_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filtrado reactivo de resultados de comparación
  const filteredResults = comparisonResults.filter(item => 
    item.productoNombre.toLowerCase().includes(filterQuery.toLowerCase()) ||
    item.codigo.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const totalDiferencias = comparisonResults.filter(r => r.diferencia !== 0).length;
  const totalCoincidencias = comparisonResults.filter(r => r.diferencia === 0).length;
  const impactoTotalFinanciero = comparisonResults.reduce((sum, item) => sum + item.impactoFinanciero, 0);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-orange-100/50 rounded-lg">
          <TabsTrigger 
            value="exportacion"
            className="rounded-md py-2 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-orange-800 data-[state=active]:shadow-sm text-orange-700 hover:text-orange-900"
          >
            Exportar Inventario
          </TabsTrigger>
          <TabsTrigger 
            value="comparacion"
            className="rounded-md py-2 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-orange-800 data-[state=active]:shadow-sm text-orange-700 hover:text-orange-900"
          >
            Cruzar y Comparar PDF
          </TabsTrigger>
        </TabsList>
        
        {/* PESTAÑA: EXPORTACIÓN */}
        <TabsContent value="exportacion" className="mt-6">
          <div className="bg-white border border-orange-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-orange-50">
              <div>
                <h2 className="text-xl font-bold text-orange-950 flex items-center gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-orange-600" />
                  Generar Plantilla de Inventario (.xlsx)
                </h2>
                <p className="text-xs text-orange-600/70 mt-1">
                  Exporta las existencias reales en el sistema estructuradas para auditar inventario físico.
                </p>
              </div>
              <Button 
                onClick={() => setShowExportDialog(true)} 
                className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm transition-all"
              >
                <Download className="mr-2 h-4 w-4" /> Configurar Exportación
              </Button>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-orange-900/50 mt-6 border-2 border-dashed border-orange-200/60 rounded-xl bg-orange-50/20">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4 border border-orange-100">
                <FileSpreadsheet className="h-10 w-10 text-orange-500 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-orange-950">Descarga consolidada en 1 click</p>
              <p className="text-xs text-orange-600/70 mt-1">Configura y genera tu archivo Excel para iniciar la auditoría física.</p>
            </div>
          </div>
        </TabsContent>
        
        {/* PESTAÑA: COMPARACIÓN */}
        <TabsContent value="comparacion" className="mt-6">
          {comparisonResults.length > 0 ? (
            <div className="space-y-6">
              {/* Tarjetas de Estadísticas e Impacto */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block font-medium">Discrepancias Detectadas</span>
                    <span className="text-2xl font-bold text-orange-700">{totalDiferencias}</span>
                  </div>
                </div>

                <div className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-lg text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block font-medium">Coincidencias Exactas</span>
                    <span className="text-2xl font-bold text-green-700">{totalCoincidencias}</span>
                  </div>
                </div>

                <div className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${impactoTotalFinanciero >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                    <TrendingDown className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block font-medium">Impacto Financiero Total</span>
                    <span className={`text-xl font-bold ${impactoTotalFinanciero >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {impactoTotalFinanciero.toLocaleString('es-CU', { style: 'currency', currency: 'CUP' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contenedor de Grilla y Filtro */}
              <div className="bg-white border border-orange-100 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-orange-950">Resultados de Conciliación</h3>
                    <p className="text-xs text-orange-600/70 mt-0.5">Muestra discrepancias entre existencias en base de datos vs reporte cargado.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-orange-400" />
                      <Input
                        type="text"
                        placeholder="Buscar producto o código..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="pl-9 h-9 w-full sm:w-[240px] border-orange-100 focus:border-orange-400 focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setComparisonResults([]);
                          setFilterQuery("");
                        }} 
                        className="flex-1 sm:flex-none border-orange-200 text-orange-700 hover:bg-orange-50 h-9"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Resetear
                      </Button>
                      <Button 
                        onClick={exportComparisonToExcel} 
                        className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm h-9"
                      >
                        <Download className="mr-2 h-4 w-4" /> Exportar Resultados (.xlsx)
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border border-orange-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-orange-50/50">
                        <TableRow>
                          <TableHead className="font-semibold text-orange-900 w-[150px]">Código</TableHead>
                          <TableHead className="font-semibold text-orange-900">Producto</TableHead>
                          <TableHead className="text-center font-semibold text-orange-900">Precio Compra</TableHead>
                          <TableHead className="text-center font-semibold text-orange-900">Sistema (Web)</TableHead>
                          <TableHead className="text-center font-semibold text-orange-900">Contado (PDF)</TableHead>
                          <TableHead className="text-center font-semibold text-orange-900">Diferencia</TableHead>
                          <TableHead className="text-center font-semibold text-orange-900">Impacto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.length > 0 ? (
                          filteredResults.map((item, idx) => {
                            const isMatch = item.diferencia === 0;
                            const isLoss = item.diferencia > 0; // Hay más en el sistema que en el PDF (pérdida física)
                            
                            return (
                              <TableRow key={idx} className="hover:bg-orange-50/20 transition-colors">
                                <TableCell className="font-mono text-xs text-orange-900 font-medium py-3">{item.codigo}</TableCell>
                                <TableCell className="font-medium text-gray-800 py-3 max-w-[200px] truncate">{item.productoNombre}</TableCell>
                                <TableCell className="text-center text-gray-500 py-3 font-medium">
                                  {item.precioCompra.toLocaleString('es-CU', { style: 'currency', currency: 'CUP' })}
                                </TableCell>
                                <TableCell className="text-center font-bold text-blue-700 bg-blue-50/20 py-3 w-[110px]">{item.cantidadWeb}</TableCell>
                                <TableCell className="text-center font-bold text-purple-700 bg-purple-50/20 py-3 w-[110px]">{item.cantidadPDF}</TableCell>
                                <TableCell className={`text-center font-bold py-3 w-[100px] ${
                                  isMatch ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {isMatch ? "Coincide" : item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                </TableCell>
                                <TableCell className={`text-center font-bold py-3 w-[120px] ${
                                  isMatch ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {isMatch ? '-' : `${item.impactoFinanciero >= 0 ? '+' : ''}${item.impactoFinanciero.toFixed(2)}`}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-gray-400 font-medium italic">
                              No se encontraron resultados que coincidan con la búsqueda.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-orange-100 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="bg-orange-50 p-6 rounded-full mb-6 border border-orange-100/50">
                <FileText className="h-12 w-12 text-orange-600 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-orange-950">Comparar PDF Físico vs Inventario del Sistema</h3>
              <p className="text-orange-700/70 max-w-md mt-2 text-xs leading-relaxed">
                Sube un reporte físico digitalizado en formato PDF para contrastarlo de forma inteligente y automatizada contra las existencias registradas en la web.
              </p>
              <Button 
                onClick={() => setShowCompareDialog(true)} 
                className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-md transition-transform active:scale-95"
              >
                <Upload className="mr-2 h-4 w-4" /> Iniciar Cruce de Inventarios
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO: EXPORTACIÓN CONFIGURABLE */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-2xl border border-orange-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-orange-950">Configurar Reporte de Inventario</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <p className="text-xs text-orange-700/80 bg-orange-50 p-3 rounded-xl border border-orange-100/40">
              Selecciona las fuentes del sistema que deseas consolidar en el libro de Excel para la auditoría física.
            </p>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">Inventario Central</h4>
              <div className="flex items-center space-x-3 p-3 bg-orange-50/20 rounded-xl border border-orange-100/50 hover:bg-orange-50/40 transition-colors">
                <Checkbox 
                  id="export-almacen" 
                  checked={includeAlmacen} 
                  onCheckedChange={(checked) => setIncludeAlmacen(checked === true)}
                  className="border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="export-almacen" className="flex-grow font-semibold cursor-pointer text-sm text-gray-700">
                  Almacén Central (Stock Principal)
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">Existencias por Puntos de Venta</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleToggleAllVendors}
                  className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                >
                  {selectedVendors.length === vendedores.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-orange-100/60 rounded-xl p-3 bg-gray-50/30">
                {vendedores.length > 0 ? (
                  vendedores.map(v => (
                    <div key={v.id} className="flex items-center space-x-3 p-2 hover:bg-orange-50/30 rounded-lg transition-colors">
                      <Checkbox 
                        id={`export-v-${v.id}`} 
                        checked={selectedVendors.includes(v.id)} 
                        onCheckedChange={() => handleToggleVendor(v.id)} 
                        className="border-orange-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label htmlFor={`export-v-${v.id}`} className="flex-grow text-sm cursor-pointer text-gray-600 font-medium">
                        {v.nombre}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-gray-400 py-4 italic">No se encontraron vendedores en el sistema.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowExportDialog(false)} 
              className="w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || (!includeAlmacen && selectedVendors.length === 0)}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium"
            >
              {isExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando...</> : "Generar Archivo (.xlsx)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO MULTIPASO PARA LA COMPARATIVA */}
      <Dialog open={showCompareDialog} onOpenChange={(open) => {
        setShowCompareDialog(open);
        if (!open) {
          setCompareStep(1);
          setPdfData([]);
          setCompareVendors([]);
          setCompareIncludeAlmacen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl border border-orange-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-orange-950">Asistente de Comparación - Paso {compareStep} de 2</DialogTitle>
          </DialogHeader>

          {/* PASO 1: UPLOAD DE PDF */}
          {compareStep === 1 && (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div 
                className="w-full border-2 border-dashed border-orange-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-orange-50/10 hover:bg-orange-50/40 transition-all cursor-pointer group hover:border-orange-400"
                onClick={() => fileInputRef.current?.click()}
              >
                {isParsingPDF ? (
                  <div className="flex flex-col items-center py-4">
                    <Loader2 className="h-12 w-12 text-orange-600 animate-spin mb-4" />
                    <p className="text-sm font-semibold text-orange-950">Leyendo y analizando PDF...</p>
                    <p className="text-xs text-orange-600/70 mt-1">Extrayendo texto y mapeando estructuras binarias</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-orange-400 mb-4 group-hover:scale-110 group-hover:text-orange-600 transition-all" />
                    <p className="text-sm font-bold text-orange-950 text-center">Subir reporte de inventario físico (PDF)</p>
                    <p className="text-xs text-orange-600/70 mt-2 text-center max-w-[280px]">
                      Arrastra tu archivo aquí o haz click para explorar. Buscaremos automáticamente códigos de barra y cantidades físicas.
                    </p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={handleFileChange} 
                />
              </div>
              <div className="flex items-start gap-2.5 text-xs text-orange-850 bg-orange-50/50 p-3 rounded-xl border border-orange-100/50 w-full">
                <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-orange-900/90 leading-normal">
                  Asegúrate de que el documento contenga códigos de barras válidos (ej. EAN-13, 12 dígitos, o dotted EAN) junto a su cantidad.
                </p>
              </div>
            </div>
          )}

          {/* PASO 2: SELECCIONAR FUENTE DE COMPARACIÓN */}
          {compareStep === 2 && (
            <div className="py-4 space-y-6">
              <div className="flex items-center justify-between bg-green-50 p-3.5 rounded-xl border border-green-100/60 shadow-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-green-800">PDF leido: {pdfData.length} productos detectados</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCompareStep(1)} className="text-xs h-7 text-orange-700 hover:bg-orange-100 hover:text-orange-800 font-semibold px-2">Cambiar PDF</Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-orange-900 uppercase tracking-wider">Cruzar contra las siguientes fuentes del sistema:</h3>
                
                <div className="flex items-center space-x-3 p-3.5 bg-orange-50/20 rounded-xl border border-orange-100/50 hover:bg-orange-50/40 transition-colors">
                  <Checkbox 
                    id="compare-almacen" 
                    checked={compareIncludeAlmacen} 
                    onCheckedChange={(checked) => setCompareIncludeAlmacen(checked === true)}
                    className="border-orange-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="compare-almacen" className="flex-grow font-semibold cursor-pointer text-sm text-gray-700">
                    Almacén Central (Stock Principal)
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">Existencias por Puntos de Venta</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (compareVendors.length === vendedores.length) {
                          setCompareVendors([]);
                        } else {
                          setCompareVendors(vendedores.map(v => v.id));
                        }
                      }}
                      className="text-xs text-orange-600 hover:text-orange-700 font-semibold h-7 px-1.5"
                    >
                      {compareVendors.length === vendedores.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border border-orange-100/60 rounded-xl p-3 bg-gray-50/30">
                    {vendedores.map(v => (
                      <div key={v.id} className="flex items-center space-x-3 p-2 hover:bg-orange-50/30 rounded-lg transition-colors">
                        <Checkbox 
                          id={`compare-v-${v.id}`} 
                          checked={compareVendors.includes(v.id)} 
                          onCheckedChange={() => setCompareVendors(prev => 
                            prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id]
                          )} 
                          className="border-orange-300 text-orange-600 focus:ring-orange-500"
                        />
                        <label htmlFor={`compare-v-${v.id}`} className="flex-grow text-sm cursor-pointer text-gray-600 font-medium">
                          {v.nombre}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCompareStep(1)} 
                  className="w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  Atrás
                </Button>
                <Button 
                  onClick={handleStartComparison} 
                  disabled={isExporting || (compareVendors.length === 0 && !compareIncludeAlmacen)}
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm"
                >
                  {isExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : "Confirmar y Cruzar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
