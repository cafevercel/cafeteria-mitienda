'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  BarChart2, 
  Send, 
  X, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Loader2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/ai/models';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sql?: string;
  proveedor?: string;
  modeloUsado?: string;
  tiempoMs?: number;
  error?: string;
  timestamp: string;
}

const EXECUTIVE_QUICK_QUERIES = [
  { 
    icon: Calendar, 
    label: 'Ventas de hoy por vendedor', 
    description: 'Volumen total y distribución por punto de venta',
    query: '¿Cuáles han sido las ventas totales de hoy desglosadas por vendedor?' 
  },
  { 
    icon: Users, 
    label: 'Rendimiento comercial mensual', 
    description: 'Comparativa de ventas y margen generado por vendedor',
    query: '¿Qué vendedor está rindiendo mejor en ventas y ganancias este mes?' 
  },
  { 
    icon: TrendingUp, 
    label: 'Margen de ganancia acumulado', 
    description: 'Cálculo de rentabilidad bruta en el período en curso',
    query: '¿Cuál es nuestro margen de ganancia bruto acumulado este mes?' 
  },
  { 
    icon: Package, 
    label: 'Productos de mayor rotación', 
    description: 'Top 5 productos con mayor volumen y ganancia neta',
    query: '¿Cuáles son los 5 productos más vendidos de la última semana y cuánto dejaron de ganancia?' 
  },
  { 
    icon: AlertCircle, 
    label: 'Auditoría de inventario crítico', 
    description: 'Artículos con stock inferior al umbral mínimo en almacén',
    query: '¿Qué productos tienen menos de 10 unidades en stock en almacén?' 
  },
];

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSqlIds, setExpandedSqlIds] = useState<Record<string, boolean>>({});
  
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('ai_selected_model') || DEFAULT_MODEL;
      } catch (e) {
        return DEFAULT_MODEL;
      }
    }
    return DEFAULT_MODEL;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ai_chat_history');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error cargando historial de chat:', e);
      }
    }
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ai_selected_model', selectedModel);
    } catch (e) {
      console.error('Error guardando modelo:', e);
    }
  }, [selectedModel]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error('Error guardando historial:', e);
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const currentModelMeta = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mensaje: textToSend,
          modelo: selectedModel 
        }),
      });

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: data.respuesta || 'No se obtuvo respuesta del servicio de datos.',
        sql: data.sqlEjecutado,
        proveedor: data.proveedor,
        modeloUsado: data.proveedor === 'Gemini' ? 'Google Gemini' : currentModelMeta.nombre,
        tiempoMs: data.tiempoMs,
        error: data.error,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `asst_err_${Date.now()}`,
        sender: 'assistant',
        text: 'Error de comunicación con el servicio de base de datos. Verifique la conexión del servidor.',
        error: err.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('ai_chat_history');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSql = (id: string) => {
    setExpandedSqlIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableBuffer.length === 0) return;
      const rows = tableBuffer.map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim())
      );

      if (rows.length >= 2) {
        const headers = rows[0];
        const dataRows = rows.slice(1).filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));

        elements.push(
          <div key={`table_${keyPrefix}`} className="overflow-x-auto my-3 border border-border rounded-lg bg-card shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                    {row.map((cell, cIdx) => {
                      const isNumeric = /[\$\d%]/.test(cell);
                      return (
                        <td 
                          key={cIdx} 
                          className={`px-3 py-2 text-xs font-mono ${isNumeric ? 'text-foreground' : 'text-foreground/90'}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableBuffer = [];
    };

    lines.forEach((line, idx) => {
      const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');

      if (isTableRow) {
        tableBuffer.push(line);
      } else {
        if (tableBuffer.length > 0) {
          flushTable(idx);
        }

        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        const trimmed = line.trim();

        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          elements.push(
            <h4 key={idx} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1.5 border-b border-border/40 pb-1">
              {trimmed.replace(/^#+\s*/, '')}
            </h4>
          );
        } else if (trimmed.toLowerCase().startsWith('observación analítica:') || trimmed.toLowerCase().startsWith('observacion analitica:')) {
          elements.push(
            <div key={idx} className="my-2.5 p-2.5 rounded-md border-l-2 border-primary bg-primary/5 text-foreground text-xs leading-relaxed">
              <span className="font-semibold text-primary block mb-0.5 text-[11px] uppercase tracking-wide">
                Observación analítica
              </span>
              <span>{trimmed.replace(/^observaci[oó]n anal[ií]tica:\s*/i, '')}</span>
            </div>
          );
        } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          elements.push(
            <div key={idx} className="flex items-start space-x-2 my-1 pl-1">
              <span className="text-muted-foreground text-xs mt-0.5">•</span>
              <span className="text-xs leading-relaxed text-foreground/90">
                {formattedLine}
              </span>
            </div>
          );
        } else if (trimmed === '') {
          elements.push(<div key={idx} className="h-1.5" />);
        } else {
          elements.push(
            <p key={idx} className="text-xs leading-relaxed text-foreground/90">
              {formattedLine}
            </p>
          );
        }
      }
    });

    if (tableBuffer.length > 0) {
      flushTable(lines.length);
    }

    return elements;
  };

  return (
    <>
      {/* Botón Flotante Premium */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white px-4 py-2.5 rounded-full shadow-lg border border-zinc-700/60 dark:border-zinc-300 transition-all duration-200 hover:shadow-xl group"
            title="Abrir panel de analítica"
          >
            <BarChart2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium tracking-wide">Analítica</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        )}
      </div>

      {/* Ventana de Diálogo Principal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 shadow-2xl rounded-xl border border-border bg-card text-card-foreground flex flex-col overflow-hidden ${
            isExpanded
              ? 'inset-3 md:inset-8'
              : 'bottom-6 right-6 w-[95vw] sm:w-[480px] h-[680px] max-h-[90vh]'
          }`}
        >
          {/* Header Superior Sobrio */}
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-md bg-muted border border-border text-foreground">
                <BarChart2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-xs tracking-tight text-foreground flex items-center gap-1.5">
                  Panel de Analítica de Negocio
                </h3>
                <p className="text-[11px] text-muted-foreground">Consultas directas a base de datos central</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearChat}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Reiniciar conversación"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex"
                title={isExpanded ? 'Reducir' : 'Expandir'}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Cerrar panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selector de Modo de Procesamiento */}
          <div className="px-3.5 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              Modo:
            </span>

            <div className="flex items-center space-x-1 bg-muted/80 p-0.5 rounded-lg border border-border/80">
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    title={m.descripcion}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all shrink-0 ${
                      isSelected
                        ? 'bg-card text-foreground font-semibold shadow-2xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    {m.tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subheader de Contexto */}
          <div className="px-3.5 py-1.5 bg-muted/20 border-b border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">
              Motor: <span className="font-medium text-foreground">{currentModelMeta.nombre}</span>
            </span>
            <span className="text-[10px] text-muted-foreground/80 shrink-0">
              {currentModelMeta.tier === 'free' ? 'Modo sin costo' : 'Consumo por consulta'}
            </span>
          </div>

          {/* Área de Conversación */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center px-1 py-4">
                <div className="mb-4">
                  <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1">
                    Consultas analíticas predefinidas
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Seleccione un informe rápido o formule una consulta específica sobre ventas, inventario o márgenes.
                  </p>
                </div>

                <div className="space-y-1.5">
                  {EXECUTIVE_QUICK_QUERIES.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.query)}
                        className="w-full text-left p-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-medium text-foreground truncate">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{item.description}</div>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`rounded-lg p-3 text-xs leading-relaxed shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground max-w-[85%]'
                        : 'bg-card border border-border text-card-foreground w-full space-y-2'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <>
                        <div className="prose-xs dark:prose-invert">
                          {renderFormattedText(msg.text)}
                        </div>

                        {/* Botón de alternancia rápida si no hay saldo */}
                        {msg.text.includes('CRÉDITOS_INSUFICIENTES') && (
                          <div className="pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedModel('nvidia/nemotron-3.5-lightning:free')}
                              className="text-xs border-border hover:bg-muted"
                            >
                              Cambiar al modo Estándar (Sin costo)
                            </Button>
                          </div>
                        )}

                        {/* Desplegable de auditoría SQL */}
                        {msg.sql && (
                          <div className="pt-2 border-t border-border/60">
                            <button
                              onClick={() => toggleSql(msg.id)}
                              className="flex items-center space-x-1.5 text-[10px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                            >
                              <Terminal className="h-3 w-3" />
                              <span>{expandedSqlIds[msg.id] ? 'Ocultar consulta SQL' : 'Auditoría SQL'}</span>
                              {expandedSqlIds[msg.id] ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>

                            {expandedSqlIds[msg.id] && (
                              <div className="mt-1.5 p-2 rounded-md bg-zinc-950 text-zinc-300 font-mono text-[10px] overflow-x-auto border border-zinc-800">
                                <code>{msg.sql}</code>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Metadatos del mensaje */}
                        <div className="flex items-center justify-between pt-1.5 text-[10px] text-muted-foreground border-t border-border/40 font-mono">
                          <div className="flex items-center space-x-1.5">
                            {msg.proveedor && (
                              <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] text-foreground font-sans">
                                {msg.proveedor} • {msg.modeloUsado}
                              </span>
                            )}
                            {msg.tiempoMs && (
                              <span>{(msg.tiempoMs / 1000).toFixed(2)}s</span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span>{msg.timestamp}</span>
                            <button
                              onClick={() => copyToClipboard(msg.text, msg.id)}
                              className="hover:text-foreground text-muted-foreground transition-colors"
                              title="Copiar informe"
                            >
                              {copiedId === msg.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Indicador de procesamiento sobrio */}
            {loading && (
              <div className="flex items-center space-x-2 p-3 bg-muted/40 rounded-lg border border-border/70 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Consultando registros en base de datos...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Entrada de Consultas */}
          <div className="p-3 bg-card border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <Input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Consulte ventas, márgenes, inventario o vendedores..."
                disabled={loading}
                className="text-xs h-9 rounded-md bg-background border-border focus-visible:ring-primary"
              />
              <Button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="h-9 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-2xs"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground px-0.5">
              <span>Auditoría de solo lectura sobre PostgreSQL</span>
              <span className="font-mono text-[9px]">v1.2</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
