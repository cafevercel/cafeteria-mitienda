'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Database, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Loader2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  AlertTriangle,
  Bot,
  User as UserIcon,
  Cpu,
  Zap,
  Flame,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/ai/openrouter';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sql?: string;
  modeloUsado?: string;
  tiempoMs?: number;
  error?: string;
  timestamp: string;
}

const QUICK_SUGGESTIONS = [
  { icon: TrendingUp, label: 'Ventas de hoy', query: '¿Cuáles han sido las ventas totales de hoy desglosadas por vendedor?' },
  { icon: Users, label: 'Mejor vendedor', query: '¿Qué vendedor está rindiendo mejor en ventas y ganancias este mes?' },
  { icon: DollarSign, label: 'Margen de ganancia', query: '¿Cuál es nuestro margen de ganancia bruto acumulado este mes?' },
  { icon: Package, label: 'Más vendidos', query: '¿Cuáles son los 5 productos más vendidos de la última semana y cuánto dejaron de ganancia?' },
  { icon: AlertTriangle, label: 'Stock crítico', query: '¿Qué productos tienen menos de 10 unidades en stock en almacén?' },
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

  // Guardar modelo seleccionado en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ai_selected_model', selectedModel);
    } catch (e) {
      console.error('Error guardando modelo:', e);
    }
  }, [selectedModel]);

  // Guardar mensajes en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error('Error guardando historial:', e);
    }
  }, [messages]);

  // Auto-scroll hacia el final
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
        text: data.respuesta || 'No recibí respuesta del servidor.',
        sql: data.sqlEjecutado,
        modeloUsado: currentModelMeta.nombre,
        tiempoMs: data.tiempoMs,
        error: data.error,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `asst_err_${Date.now()}`,
        sender: 'assistant',
        text: '❌ Hubo un error de conexión con el servidor. Por favor, verifica tu conexión o las variables de entorno.',
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

  // Renderizador simple de markdown para listas, negrita, tablas y saltos
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
          <div key={`table_${keyPrefix}`} className="overflow-x-auto my-3 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 uppercase font-semibold">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-3 py-2 border-b">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 font-mono text-[11px]">
                        {cell}
                      </td>
                    ))}
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
              <strong key={pIdx} className="font-semibold text-zinc-900 dark:text-zinc-100">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (line.trim().startsWith('###') || line.trim().startsWith('##')) {
          elements.push(
            <h4 key={idx} className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-2 mb-1">
              {line.replace(/^#+\s*/, '')}
            </h4>
          );
        } else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
          elements.push(
            <div key={idx} className="flex items-start space-x-1.5 my-0.5 pl-2">
              <span className="text-primary text-xs mt-0.5">•</span>
              <span className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {formattedLine}
              </span>
            </div>
          );
        } else if (line.trim() === '') {
          elements.push(<div key={idx} className="h-1.5" />);
        } else {
          elements.push(
            <p key={idx} className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
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
      {/* Botón Flotante */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full shadow-2xl h-14 w-14 p-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all duration-300 hover:scale-105 group relative"
            title="Abrir Asistente IA de Negocio"
          >
            <Sparkles className="h-7 w-7 animate-pulse text-amber-200" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-zinc-950"></span>
            </span>
          </Button>
        )}
      </div>

      {/* Ventana de Chat */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 shadow-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden ${
            isExpanded
              ? 'inset-4 md:inset-10'
              : 'bottom-6 right-6 w-[95vw] sm:w-[480px] h-[670px] max-h-[90vh]'
          }`}
        >
          {/* Header Principal */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  Copiloto de Negocio
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-white/30 text-white bg-white/10">
                    OpenRouter
                  </Badge>
                </h3>
                <p className="text-[11px] text-blue-100">Consultas de ventas, márgenes e inventario</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearChat}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                  title="Limpiar chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 hidden sm:flex"
                title={isExpanded ? 'Reducir' : 'Pantalla completa'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Barra Selectora de Modelos */}
          <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400 shrink-0">
              <Cpu className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] font-medium hidden sm:inline">Modelo:</span>
            </div>

            <div className="flex items-center space-x-1 bg-white dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-2xs overflow-x-auto w-full sm:w-auto justify-end">
              {AVAILABLE_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    title={`${m.nombre} - ${m.descripcion}`}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 ${
                      isSelected
                        ? m.tier === 'free'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : m.tier === 'medium'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-purple-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    {m.tier === 'free' && <Zap className="h-3 w-3" />}
                    {m.tier === 'medium' && <Flame className="h-3 w-3" />}
                    {m.tier === 'pro' && <Crown className="h-3 w-3" />}
                    <span>{m.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner informativo del modelo activo */}
          <div className="px-3.5 py-1.5 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="truncate">
              Activo: <strong className="text-zinc-900 dark:text-zinc-200">{currentModelMeta.nombre}</strong>
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
              {currentModelMeta.tier === 'free' ? '🎉 Sin gasto de saldo' : '💳 Consume créditos'}
            </span>
          </div>

          {/* Cuerpo de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center px-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                  <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-1">
                  ¡Hola! ¿Qué deseas consultar hoy?
                </h4>
                <p className="text-xs text-zinc-500 max-w-xs mb-5">
                  Pregúntame cualquier dato sobre ventas por fecha, productos más vendidos, márgenes o rendimiento de vendedores.
                </p>

                <div className="w-full space-y-2">
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-left pl-1">
                    Sugerencias rápidas:
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 text-left">
                    {QUICK_SUGGESTIONS.map((item, idx) => {
                      const IconComp = item.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(item.query)}
                          className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-xs transition-all text-zinc-700 dark:text-zinc-300 group"
                        >
                          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50">
                            <IconComp className="h-4 w-4" />
                          </div>
                          <span className="font-medium flex-1">{item.label}</span>
                          <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Preguntar →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-start space-x-2 max-w-[90%]">
                    {msg.sender === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl p-3.5 shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none w-full'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="text-xs whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="prose-xs dark:prose-invert">
                            {renderFormattedText(msg.text)}
                          </div>

                          {/* Botón de cambio rápido si faltan créditos */}
                          {msg.text.includes('CRÉDITOS_INSUFICIENTES') && (
                            <div className="pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedModel('nvidia/nemotron-3.5-lightning:free')}
                                className="text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                <Zap className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                Cambiar a modelo Gratuito (NVIDIA Nemotron)
                              </Button>
                            </div>
                          )}

                          {/* Sección técnica SQL desplegable */}
                          {msg.sql && (
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                              <button
                                onClick={() => toggleSql(msg.id)}
                                className="flex items-center space-x-1 text-[10px] text-zinc-500 hover:text-blue-600 font-medium transition-colors"
                              >
                                <Database className="h-3 w-3" />
                                <span>{expandedSqlIds[msg.id] ? 'Ocultar consulta SQL' : 'Ver consulta SQL'}</span>
                                {expandedSqlIds[msg.id] ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>

                              {expandedSqlIds[msg.id] && (
                                <div className="mt-2 p-2 rounded-lg bg-zinc-950 text-emerald-400 font-mono text-[10px] overflow-x-auto border border-zinc-800">
                                  <code>{msg.sql}</code>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Footer del mensaje */}
                          <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
                            <div className="flex items-center space-x-1.5">
                              {msg.modeloUsado && (
                                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[9px] font-medium text-zinc-500">
                                  {msg.modeloUsado}
                                </span>
                              )}
                              <span>{msg.tiempoMs ? `${(msg.tiempoMs / 1000).toFixed(2)}s` : ''}</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span>{msg.timestamp}</span>
                              <button
                                onClick={() => copyToClipboard(msg.text, msg.id)}
                                className="hover:text-zinc-600 dark:hover:text-zinc-200"
                                title="Copiar respuesta"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shrink-0 mt-0.5">
                        <UserIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Indicador de carga */}
            {loading && (
              <div className="flex items-start space-x-2 max-w-[90%]">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-none p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center space-x-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {currentModelMeta.nombre} analizando datos de NeonDB...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
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
                placeholder="Pregúntame sobre ventas, productos, márgenes..."
                disabled={loading}
                className="text-xs h-10 rounded-xl focus-visible:ring-blue-500"
              />
              <Button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 px-1">
              <span>💡 Respuestas directas de PostgreSQL</span>
              <span className="font-mono text-[9px]">OpenRouter API</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
