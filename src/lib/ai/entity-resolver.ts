import { query } from '@/lib/db';

export interface CachedUser {
  id: number;
  nombre: string;
  nombreTrim: string;
  norm: string;
  phonetic: string;
  rol: string;
  activo: boolean;
}

export interface CachedProduct {
  id: number;
  nombre: string;
  nombreTrim: string;
  baseNorm: string;
  basePhonetic: string;
  tokensNorm: string[];
  tokensPhonetic: string[];
  seccion: string;
  seccionTrim: string;
  codigoBarras: string | null;
}

export interface CachedSection {
  raw: string;
  trim: string;
  norm: string;
  phonetic: string;
  tokensNorm: string[];
  tokensPhonetic: string[];
}

export interface CatalogSnapshot {
  fetchedAt: number;
  usuarios: CachedUser[];
  productos: CachedProduct[];
  secciones: CachedSection[];
  schemaColumns: Record<string, string[]>;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let catalogCache: CatalogSnapshot | null = null;
let pendingLoad: Promise<CatalogSnapshot> | null = null;

// Palabras vacías y vocabulario técnico de negocio que NO deben disparar falsos positivos de productos
const BUSINESS_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'con', 'sin',
  'por', 'para', 'entre', 'sobre', 'hacia', 'desde', 'hasta', 'que', 'cual', 'cuales', 'quien',
  'quienes', 'como', 'cuando', 'donde', 'cuanto', 'cuantos', 'cuanta', 'cuantas', 'todo', 'todos',
  'toda', 'todas', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'mas', 'menos',
  'muy', 'solo', 'solamente', 'unicamente', 'si', 'no', 'ni', 'pero', 'sino', 'porque', 'aunque',
  'hay', 'hubo', 'habia', 'tiene', 'tienen', 'tener', 'ser', 'estar', 'es', 'son', 'fue', 'fueron',
  'han', 'ha', 'he', 'hacer', 'hizo', 'dame', 'dime', 'muestra', 'muestrame', 'mostrar', 'lista',
  'listar', 'ver', 'busca', 'buscar', 'calcula', 'calcular', 'analiza', 'analizar', 'actua',
  'analista', 'senior', 'datos', 'rentabilidad', 'tienda', 'cafeteria', 'punto', 'puntos',
  'venta', 'ventas', 'sucursal', 'sucursales', 'almacen', 'central', 'bodega', 'local', 'sede',
  'stock', 'disponible', 'disponibles', 'existencia', 'existencias', 'inventario', 'inventarios',
  'producto', 'productos', 'articulo', 'articulos', 'item', 'items', 'mercancia', 'categoria',
  'categorias', 'seccion', 'secciones', 'departamento', 'rubro', 'linea', 'familia', 'grupo',
  'precio', 'precios', 'costo', 'costos', 'coste', 'compra', 'compras', 'ganancia', 'ganancias',
  'bruta', 'bruto', 'neta', 'neto', 'utilidad', 'utilidades', 'beneficio', 'margen', 'margenes',
  'porcentaje', 'tasa', 'volumen', 'rotacion', 'rendimiento', 'diferencia', 'diferencias',
  'mayor', 'menor', 'mejor', 'peor', 'mejores', 'peores', 'alto', 'alta', 'bajo', 'baja',
  'total', 'totales', 'promedio', 'suma', 'cantidad', 'unidades', 'unidad', 'piezas', 'pieza',
  'fecha', 'fechas', 'dia', 'dias', 'hoy', 'ayer', 'semana', 'semanas', 'mes', 'meses', 'anio',
  'ano', 'anos', 'ultimo', 'ultimos', 'ultima', 'ultimas', 'actual', 'actuales', 'periodo',
  'rango', 'historico', 'historial', 'reporte', 'informe', 'resumen', 'tabla', 'tablas',
  'columna', 'columnas', 'campo', 'campos', 'registro', 'registros', 'fila', 'filas', 'valor',
  'valores', 'nombre', 'nombres', 'descripcion', 'codigo', 'sku', 'barcode', 'barras',
  'vendedor', 'vendedores', 'empleado', 'empleados', 'trabajador', 'trabajadores', 'usuario',
  'usuarios', 'cliente', 'clientes', 'pago', 'pagos', 'metodo', 'efectivo', 'transferencia',
  'mixto', 'banco', 'cuenta', 'gasto', 'gastos', 'salario', 'salarios', 'merma', 'mermas',
  'perdida', 'perdidas', 'transaccion', 'transacciones', 'entrega', 'entregas', 'baja', 'bajas',
  'plan', 'esquema', 'estrategia', 'promocionar', 'combinar', 'reubicar', 'agotado', 'agotados',
  'cero', 'negativo', 'positivo', 'umbral', 'percentil', 'top', 'ranking', 'matriz', 'matrices',
  'moneda', 'cup', 'usd', 'mlc', 'pesos', 'dolares', 'orden', 'ordena', 'ordenar', 'agrupa',
  'agrupar', 'filtra', 'filtrar', 'filtro', 'filtros', 'regla', 'obligatoria', 'contexto',
  'objetivo', 'parametro', 'parametros', 'editables', 'estacionalidad', 'compara', 'comparar',
  'comparativa', 'evalua', 'evaluar', 'identifica', 'identificar', 'prioriza', 'priorizando',
  'prioridad', 'excluye', 'excluir', 'muestres', 'muestre', 'sugieras', 'ejemplo', 'ejemplos',
  'sql', 'select', 'where', 'from', 'join', 'group', 'order', 'limit', 'having', 'and', 'or',
  'not', 'null', 'true', 'false', 'esta', 'cual', 'quedan', 'queda', 'vendio', 'vendieron',
  'vender', 'vendido', 'vendidos', 'vendidas', 'vendida', 'generan', 'genera', 'dejan', 'deja',
  'tengan', 'tenga', 'poco', 'poca', 'mucho', 'mucha', 'cada', 'otra', 'otro', 'otros', 'otras',
  'ambas', 'ambos', 'solo', 'sola', 'solos', 'solas', 'entre', 'cerca', 'lejos', 'menos',
]);

// Palabras de usuarios que coinciden con lenguaje común y no deben hacer match sueltas
const AMBIGUOUS_USER_WORDS = new Set([
  'almacen', 'inventarios', 'inventario', 'ejemplo', 'campo', 'jose', 'ml',
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bsta\b/g, 'santa')
    .replace(/\bsnt\b/g, 'santa')
    .replace(/\bsto\b/g, 'santo')
    .replace(/\bpdv\b/g, 'punto de venta')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stemSpanishToken(token: string): string {
  if (token.length >= 5 && token.endsWith('es')) {
    return token.slice(0, -2);
  }
  if (token.length >= 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Codificador fonético adaptado al español (y préstamos comunes en retail):
 * unifica b/v, c(e,i)/z/s, qu/k/c(a,o,u), ll/y, g(e,i)/j, elimina h muda y letras duplicadas.
 */
export function toSpanishPhonetic(normalized: string): string {
  if (!normalized) return '';
  let s = normalized
    .replace(/ch/g, '@')
    .replace(/wh/g, 'w')
    .replace(/h/g, '')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/gue/g, 'ge')
    .replace(/gui/g, 'gi')
    .replace(/ge/g, 'je')
    .replace(/gi/g, 'ji')
    .replace(/ce/g, 'se')
    .replace(/ci/g, 'si')
    .replace(/z/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/v/g, 'b')
    .replace(/([a-z0-9@])\1+/g, '$1')
    .trim();
  return s;
}

export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return 1 - damerauLevenshtein(a, b) / maxLen;
}

function tokenSimilarity(rawA: string, rawB: string): number {
  const stemA = stemSpanishToken(rawA);
  const stemB = stemSpanishToken(rawB);
  const simNorm = Math.max(stringSimilarity(rawA, rawB), stringSimilarity(stemA, stemB));

  const phA = toSpanishPhonetic(stemA);
  const phB = toSpanishPhonetic(stemB);
  const simPhon = stringSimilarity(phA, phB);

  return Math.max(simNorm, simPhon);
}

async function fetchCatalogSnapshot(): Promise<CatalogSnapshot> {
  try {
    const [usersRes, prodsRes, colsRes] = await Promise.all([
      query('SELECT id, nombre, rol, activo FROM usuarios ORDER BY id'),
      query('SELECT id, nombre, seccion, codigo_barras FROM productos ORDER BY id'),
      query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND column_name <> 'password'
         ORDER BY table_name, ordinal_position`
      ),
    ]);

    const usuarios: CachedUser[] = (usersRes.rows || []).map((u: any) => {
      const nombreTrim = String(u.nombre || '').trim();
      const norm = normalizeText(nombreTrim);
      return {
        id: Number(u.id),
        nombre: String(u.nombre || ''),
        nombreTrim,
        norm,
        phonetic: toSpanishPhonetic(norm),
        rol: String(u.rol || ''),
        activo: Boolean(u.activo),
      };
    });

    const sectionSet = new Set<string>();
    const productos: CachedProduct[] = (prodsRes.rows || []).map((p: any) => {
      const nombreTrim = String(p.nombre || '').trim();
      const seccionRaw = String(p.seccion || '');
      const seccionTrim = seccionRaw.trim();
      if (seccionTrim) {
        sectionSet.add(seccionRaw);
      }

      // Nombre base sin paréntesis de peso/unidad para mejorar matching
      const baseClean = nombreTrim.replace(/\([^)]*\)/g, ' ').trim();
      const baseNorm = normalizeText(baseClean || nombreTrim);
      const tokensNorm = baseNorm.split(' ').filter((t) => t.length >= 2);
      const tokensPhonetic = tokensNorm.map((t) => toSpanishPhonetic(stemSpanishToken(t)));

      return {
        id: Number(p.id),
        nombre: String(p.nombre || ''),
        nombreTrim,
        baseNorm,
        basePhonetic: toSpanishPhonetic(baseNorm),
        tokensNorm,
        tokensPhonetic,
        seccion: seccionRaw,
        seccionTrim,
        codigoBarras: p.codigo_barras ? String(p.codigo_barras) : null,
      };
    });

    const secciones: CachedSection[] = Array.from(sectionSet).map((raw) => {
      const trim = raw.trim();
      const norm = normalizeText(trim);
      const tokensNorm = norm.split(' ').filter((t) => t.length >= 2 && t !== 'y');
      return {
        raw,
        trim,
        norm,
        phonetic: toSpanishPhonetic(norm),
        tokensNorm,
        tokensPhonetic: tokensNorm.map((t) => toSpanishPhonetic(stemSpanishToken(t))),
      };
    });

    const schemaColumns: Record<string, string[]> = {};
    for (const row of colsRes.rows || []) {
      const tbl = String(row.table_name);
      const col = String(row.column_name);
      if (!schemaColumns[tbl]) schemaColumns[tbl] = [];
      schemaColumns[tbl].push(col);
    }

    return {
      fetchedAt: Date.now(),
      usuarios,
      productos,
      secciones,
      schemaColumns,
    };
  } catch (err) {
    console.warn('No se pudo cargar caché de catálogo para resolver entidades:', err);
    return {
      fetchedAt: Date.now(),
      usuarios: [],
      productos: [],
      secciones: [],
      schemaColumns: {},
    };
  }
}

export async function getCatalogSnapshot(forceRefresh = false): Promise<CatalogSnapshot> {
  if (!forceRefresh && catalogCache && Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache;
  }
  if (!pendingLoad) {
    pendingLoad = fetchCatalogSnapshot().then((snap) => {
      if (snap.productos.length > 0 || snap.usuarios.length > 0) {
        catalogCache = snap;
      }
      pendingLoad = null;
      return snap;
    });
  }
  return pendingLoad;
}

export interface ResolvedBranchMatch {
  queryFragment: string;
  id: number;
  nombreExacto: string;
  rol: string;
  activo: boolean;
  score: number;
}

export interface ResolvedSectionMatch {
  queryFragment: string;
  seccionesExactas: string[];
  score: number;
}

export interface ResolvedProductMatch {
  queryFragment: string;
  productos: Array<{ id: number; nombre: string; seccion: string; score: number }>;
  totalCoincidencias: number;
}

export interface EntityResolutionResult {
  branches: ResolvedBranchMatch[];
  sections: ResolvedSectionMatch[];
  products: ResolvedProductMatch[];
  formattedHint: string;
}

function buildNgrams(
  tokens: string[],
  maxN: number
): Array<{ text: string; tokens: string[]; start: number; end: number }> {
  const result: Array<{ text: string; tokens: string[]; start: number; end: number }> = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= maxN && i + len <= tokens.length; len++) {
      const slice = tokens.slice(i, i + len);
      result.push({ text: slice.join(' '), tokens: slice, start: i, end: i + len - 1 });
    }
  }
  return result;
}

export async function resolveQueryEntities(userQuestion: string): Promise<EntityResolutionResult> {
  const catalog = await getCatalogSnapshot();
  const normQuestion = normalizeText(userQuestion);
  if (!normQuestion) {
    return { branches: [], sections: [], products: [], formattedHint: '' };
  }

  const allTokens = normQuestion.split(' ').filter(Boolean);
  const branchNgrams = buildNgrams(allTokens, 3);

  // 1. Resolver sucursales / puntos de venta
  const branchMap = new Map<number, ResolvedBranchMatch & { start: number; end: number }>();

  for (const u of catalog.usuarios) {
    if (!u.norm || AMBIGUOUS_USER_WORDS.has(u.norm)) continue;
    const withoutMl = u.norm.replace(/^ml\s+/, '').trim();
    const withoutMlJoined = withoutMl.replace(/\s+/g, '');
    const uWords = withoutMl.split(' ').filter((w) => w.length >= 4 && !AMBIGUOUS_USER_WORDS.has(w));

    for (const ng of branchNgrams) {
      if (ng.tokens.length === 1 && (AMBIGUOUS_USER_WORDS.has(ng.text) || BUSINESS_STOPWORDS.has(ng.text))) {
        continue;
      }
      if (ng.tokens.length === 1 && ng.text.length < 5) {
        continue;
      }
      if (ng.tokens.every((t) => BUSINESS_STOPWORDS.has(t))) continue;

      const ngJoined = ng.text.replace(/\s+/g, '');
      let bestScore = Math.max(
        tokenSimilarity(ng.text, u.norm),
        tokenSimilarity(ng.text, withoutMl),
        tokenSimilarity(ngJoined, withoutMlJoined)
      );

      if (ng.tokens.length === 1 && uWords.length > 0) {
        for (const uw of uWords) {
          const wSim = tokenSimilarity(ng.text, uw) * 0.92;
          if (wSim >= 0.78 && wSim > bestScore) {
            bestScore = wSim;
          }
        }
      }

      if (bestScore >= 0.80) {
        const existing = branchMap.get(u.id);
        if (!existing || bestScore > existing.score) {
          branchMap.set(u.id, {
            queryFragment: ng.text,
            id: u.id,
            nombreExacto: u.nombre,
            rol: u.rol,
            activo: u.activo,
            score: bestScore,
            start: ng.start,
            end: ng.end,
          });
        }
      }
    }
  }

  // Verificar menciones explícitas de "usuario inventarios" o "sucursal inventarios"
  if (/(usuario|sucursal|punto de venta|vendedor)\s+inventarios?\b/i.test(normQuestion)) {
    const invUser = catalog.usuarios.find((u) => u.id === 22);
    if (invUser) {
      branchMap.set(invUser.id, {
        queryFragment: 'inventarios',
        id: invUser.id,
        nombreExacto: invUser.nombre,
        rol: invUser.rol,
        activo: invUser.activo,
        score: 0.95,
        start: -1,
        end: -1,
      });
    }
  }

  // Descartar matches parciales de 1 palabra cuyo span quedó cubierto por un match completo multi-palabra (ej. "mariany perche" gana sobre "mariany")
  const rawBranches = Array.from(branchMap.values());
  const branches: ResolvedBranchMatch[] = rawBranches
    .filter((b) => {
      if (b.start < 0 || b.end - b.start >= 1) return true;
      const coveredByLonger = rawBranches.some(
        (other) =>
          other.id !== b.id &&
          other.start >= 0 &&
          other.end - other.start >= 1 &&
          b.start >= other.start &&
          b.end <= other.end &&
          other.score > b.score
      );
      return !coveredByLonger;
    })
    .map(({ start: _s, end: _e, ...rest }) => rest)
    .sort((a, b) => b.score - a.score);

  // Tokens que ya corresponden a sucursales encontradas (para no confundirlos con nombres de productos)
  const matchedBranchWords = new Set<string>();
  for (const b of branches) {
    for (const w of normalizeText(b.nombreExacto).split(' ')) {
      if (w.length >= 3) matchedBranchWords.add(w);
    }
    for (const w of b.queryFragment.split(' ')) {
      if (w.length >= 3) matchedBranchWords.add(w);
    }
  }

  // 2. Resolver secciones / categorías
  const meaningfulTokens = allTokens.filter(
    (t) => !BUSINESS_STOPWORDS.has(t) && !matchedBranchWords.has(t) && t.length >= 3
  );
  const meaningfulNgramsList = buildNgrams(meaningfulTokens, 3);
  const uniqueTextSeen = new Set<string>();
  const uniqueMeaningfulNgrams: Array<{ text: string; tokens: string[]; start: number; end: number }> = [];
  for (const ng of meaningfulNgramsList) {
    if (!uniqueTextSeen.has(ng.text)) {
      uniqueTextSeen.add(ng.text);
      uniqueMeaningfulNgrams.push(ng);
    }
  }

  const sections: ResolvedSectionMatch[] = [];
  const matchedSectionIndices = new Set<number>();

  for (const ng of uniqueMeaningfulNgrams) {
    if (ng.text.length < 4) continue;
    const matchedRawSections: Array<{ raw: string; score: number }> = [];

    for (const sec of catalog.secciones) {
      if (sec.norm === 'otros') continue;

      let secScore = 0;
      if (
        sec.norm === 'conf' &&
        (tokenSimilarity(ng.text, 'confitura') >= 0.78 || tokenSimilarity(ng.text, 'confite') >= 0.78)
      ) {
        secScore = 0.9;
      } else {
        secScore = tokenSimilarity(ng.text, sec.norm);
        if (ng.tokens.length === 1) {
          for (const st of sec.tokensNorm) {
            if (st.length < 4) continue;
            const tSim = tokenSimilarity(ng.text, st);
            if (tSim > secScore) secScore = tSim;
          }
        }
      }

      if (secScore >= 0.80) {
        matchedRawSections.push({ raw: sec.raw, score: secScore });
      }
    }

    if (matchedRawSections.length > 0) {
      const hasConf = matchedRawSections.some((m) => normalizeText(m.raw).startsWith('conf'));
      if (hasConf) {
        for (const sec of catalog.secciones) {
          if (sec.norm.startsWith('conf') && !matchedRawSections.some((m) => m.raw === sec.raw)) {
            matchedRawSections.push({ raw: sec.raw, score: 0.82 });
          }
        }
      }
      const best = Math.max(...matchedRawSections.map((m) => m.score));
      sections.push({
        queryFragment: ng.text,
        seccionesExactas: Array.from(new Set(matchedRawSections.map((m) => m.raw))),
        score: best,
      });
      for (let i = ng.start; i <= ng.end; i++) matchedSectionIndices.add(i);
    }
  }

  // 3. Resolver productos específicos (incluso con errores ortográficos)
  const productMatches: ResolvedProductMatch[] = [];
  const seenProductIds = new Set<number>();
  const consumedProductIndices = new Set<number>();

  // Ordenar n-gramas de más largos a más cortos para priorizar coincidencias compuestas ("cervesa fria" antes que "cervesa")
  const sortedNgrams = [...uniqueMeaningfulNgrams]
    .filter((ng) => {
      if (ng.text.length < 4) return false;
      if (ng.tokens.length === 1 && /^\d+$/.test(ng.text)) return false;
      return true;
    })
    .sort((a, b) => b.tokens.length - a.tokens.length || b.text.length - a.text.length);

  for (const ng of sortedNgrams) {
    // Si alguno de sus tokens ya fue consumido por una sección o por un producto compuesto más largo, saltar
    let overlapsConsumed = false;
    for (let i = ng.start; i <= ng.end; i++) {
      if (matchedSectionIndices.has(i) || consumedProductIndices.has(i)) {
        overlapsConsumed = true;
        break;
      }
    }
    if (overlapsConsumed) continue;

    const ngJoined = ng.text.replace(/\s+/g, '');
    const ngMeaningfulTokens = ng.tokens.filter((t) => t.length >= 3);
    if (ngMeaningfulTokens.length === 0) continue;

    const hits: Array<{ id: number; nombre: string; seccion: string; score: number }> = [];

    for (const prod of catalog.productos) {
      let score = 0;

      if (ngMeaningfulTokens.length === 1) {
        const qTok = ngMeaningfulTokens[0];
        const fullSim = tokenSimilarity(qTok, prod.baseNorm);
        let maxProdTokSim = 0;
        for (const pt of prod.tokensNorm) {
          if (pt.length < 4) continue;
          const sim = tokenSimilarity(qTok, pt);
          if (sim > maxProdTokSim) maxProdTokSim = sim;
        }
        if (prod.codigoBarras && prod.codigoBarras.toLowerCase() === qTok) {
          score = 1.0;
        } else if (fullSim >= 0.78) {
          score = fullSim;
        } else if (maxProdTokSim >= 0.85) {
          score = maxProdTokSim * 0.96;
        }
      } else {
        const phraseSim = Math.max(
          tokenSimilarity(ng.text, prod.baseNorm),
          tokenSimilarity(ngJoined, prod.baseNorm.replace(/\s+/g, ''))
        );

        let matchedCount = 0;
        let sumTokenSim = 0;
        for (const qt of ngMeaningfulTokens) {
          let bestTokSim = 0;
          for (const pt of prod.tokensNorm) {
            const sim = tokenSimilarity(qt, pt);
            if (sim > bestTokSim) bestTokSim = sim;
          }
          if (bestTokSim >= 0.78) {
            matchedCount++;
            sumTokenSim += bestTokSim;
          }
        }

        const coverage = matchedCount / ngMeaningfulTokens.length;
        if (coverage >= 0.99 && ngMeaningfulTokens.length >= 2) {
          const avgTok = sumTokenSim / ngMeaningfulTokens.length;
          score = Math.max(phraseSim, avgTok * 0.98);
        } else if (phraseSim >= 0.74) {
          score = phraseSim;
        }
      }

      if (score >= 0.78) {
        hits.push({
          id: prod.id,
          nombre: prod.nombreTrim,
          seccion: prod.seccionTrim,
          score,
        });
      }
    }

    if (hits.length > 0) {
      hits.sort((a, b) => b.score - a.score);
      const topHits = hits.filter((h) => !seenProductIds.has(h.id)).slice(0, 12);
      if (topHits.length > 0 && (hits.length <= 120 || ngMeaningfulTokens.length >= 2)) {
        topHits.forEach((h) => seenProductIds.add(h.id));
        for (let i = ng.start; i <= ng.end; i++) consumedProductIndices.add(i);
        productMatches.push({
          queryFragment: ng.text,
          productos: topHits,
          totalCoincidencias: hits.length,
        });
      }
    }

    if (productMatches.length >= 6) break;
  }

  // Construir pista estructurada para el modelo SQL
  const lines: string[] = [];
  if (branches.length > 0) {
    lines.push('SUCURSALES DETECTADAS PARA TÉRMINOS DE LA PREGUNTA:');
    for (const b of branches) {
      lines.push(
        `- "${b.queryFragment}" -> usuarios.id = ${b.id} (nombre exacto en DB: '${b.nombreExacto}', rol: '${b.rol}', activo: ${b.activo})`
      );
    }
  }
  if (sections.length > 0) {
    lines.push('CATEGORÍAS / SECCIONES DETECTADAS (productos.seccion exactas):');
    for (const s of sections) {
      const quoted = s.seccionesExactas.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ');
      lines.push(`- "${s.queryFragment}" -> p.seccion IN (${quoted})`);
    }
  }
  if (productMatches.length > 0) {
    lines.push('PRODUCTOS DETECTADOS EN CATÁLOGO (resueltos con tolerancia ortográfica):');
    for (const pm of productMatches) {
      const itemsStr = pm.productos
        .slice(0, 8)
        .map((p) => `id=${p.id} '${p.nombre.replace(/'/g, "''")}'`)
        .join(', ');
      const extraNote = pm.totalCoincidencias > 8 ? ` (+${pm.totalCoincidencias - 8} más similares)` : '';
      lines.push(`- "${pm.queryFragment}" -> ${itemsStr}${extraNote}`);
    }
  }

  const formattedHint =
    lines.length > 0
      ? `\nENTIDADES DETECTADAS EN LA BASE DE DATOS PARA ESTA CONSULTA:\n${lines.join('\n')}\nNOTA: Usa estas coincidencias exactas para evitar errores por faltas de ortografía, tildes o espacios finales. Si la pregunta solicita un análisis general de todos los productos de una sucursal/tienda sin restringir a un artículo puntual, NO filtres solo por un producto.\n`
      : '';

  return {
    branches,
    sections,
    products: productMatches,
    formattedHint,
  };
}

/**
 * Devuelve un resumen compacto de las columnas reales de las tablas del esquema público
 * (útil cuando una consulta falla y necesitamos auto-corregir columnas inexistentes).
 */
export async function getRealSchemaColumnsText(failedSql?: string): Promise<string> {
  const catalog = await getCatalogSnapshot();
  const cols = catalog.schemaColumns;
  const entries = Object.entries(cols);
  if (entries.length === 0) return '';

  // Priorizar tablas mencionadas en el SQL o principales
  const sqlLower = (failedSql || '').toLowerCase();
  const priority = entries.filter(([tbl]) => sqlLower.includes(tbl));
  const target = priority.length > 0 ? priority : entries;

  return target.map(([tbl, cList]) => `- ${tbl}: ${cList.join(', ')}`).join('\n');
}

/**
 * Extrae literales de texto de un SQL que devolvió 0 filas y busca sugerencias ortográficas
 * en el catálogo real para ayudar a la re-consulta automática.
 */
export async function findSuggestionsForZeroRowSql(sql: string): Promise<string> {
  const literals = new Set<string>();
  const regex = /'([^']{3,60})'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    const val = match[1].replace(/%/g, '').replace(/_/g, ' ').trim();
    if (val.length >= 3 && !/^\d{4}-\d{2}-\d{2}/.test(val) && val !== 'Vendedor' && val !== 'Almacen') {
      literals.add(val);
    }
  }
  if (literals.size === 0) return '';

  const combinedText = Array.from(literals).join(' ');
  const resolved = await resolveQueryEntities(combinedText);
  return resolved.formattedHint;
}
