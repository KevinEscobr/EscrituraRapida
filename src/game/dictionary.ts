// Diccionario en Español estructurado por frecuencia de uso y longitud de palabras.
// Nivel 1: Palabras cortas (4-5 letras)
// Nivel 2: Palabras medianas (6-8 letras) con tildes, ñ y mayor complejidad
// Nivel 3: Palabras largas (9+ letras) complejas, técnicas y espaciales

export const DICCIONARIO = {
  nivel1: [
    "casa", "gato", "azul", "mesa", "nave", "rojo", "luna", "agua", "vida", "base",
    "cero", "nube", "flor", "lobo", "pelo", "cara", "mano", "sol", "mar", "ruta",
    "rayo", "foco", "mapa", "bota", "copa", "tren", "plan", "fase", "fuego", "aire",
    "pino", "banco", "libre", "llave", "hielo", "barco", "carta", "disco", "pluma",
    "cielo", "tierra", "campo", "metal", "hoja", "fruta", "verde", "claro", "punto"
  ],
  nivel2: [
    "árbol", "avión", "difícil", "música", "rápido", "pájaro", "acción", "héroe",
    "átomo", "órbita", "galaxia", "planeta", "escudo", "español", "cometa", "estrella",
    "máquina", "cristal", "sistema", "energía", "fuerza", "peligro", "ataque", "pantalla",
    "teclado", "bosque", "camino", "futuro", "hierro", "jardín", "origen", "silencio",
    "universo", "riqueza", "campeón", "viento", "brújula", "antena", "cápsula", "sonda",
    "núcleo", "radar", "óxido", "hélice", "imán", "cónico", "cráter", "vórtice", "plasma"
  ],
  nivel3: [
    "computación", "electricidad", "constelación", "gravedad", "atmósfera", "velocidad",
    "tecnología", "resistencia", "civilización", "astronómico", "dimensional", "laboratorio",
    "transbordador", "comunicación", "antimateria", "hiperespacio", "termonuclear",
    "supercomputadora", "antiaéreo", "inteligencia", "programación", "intergaláctico",
    "nanotecnología", "revolucionario", "extraordinario", "telescopio", "supernova",
    "astrometría", "electromagnetismo", "cronómetro", "biotecnología", "sincrotrón",
    "fotosíntesis", "microscopio", "infraestructura", "biodiversidad", "personalidad"
  ]
};

/**
 * Retorna una palabra aleatoria según la progresión o nivel de complejidad del juego.
 */
export function obtenerPalabraPorNivel(
  nivelJuego: number,
  complejidad: "basico" | "intermedio" | "avanzado" | "progresivo" = "progresivo"
): string {
  // Manejar complejidades fijas
  if (complejidad === "basico") {
    const index = Math.floor(Math.random() * DICCIONARIO.nivel1.length);
    return DICCIONARIO.nivel1[index];
  }
  if (complejidad === "intermedio") {
    const rand = Math.random();
    const palabras = rand < 0.65 ? DICCIONARIO.nivel1 : DICCIONARIO.nivel2;
    const index = Math.floor(Math.random() * palabras.length);
    return palabras[index];
  }
  if (complejidad === "avanzado") {
    const rand = Math.random();
    const palabras = rand < 0.5 ? DICCIONARIO.nivel2 : DICCIONARIO.nivel3;
    const index = Math.floor(Math.random() * palabras.length);
    return palabras[index];
  }

  // Complejidad progresiva (comportamiento original)
  const rand = Math.random();

  // Pesos de probabilidad para seleccionar de cada categoría del diccionario según el nivel
  let p1 = 1.0; // Probabilidad de palabras cortas
  let p2 = 0.0; // Probabilidad de palabras medianas

  if (nivelJuego === 1) {
    p1 = 1.0;
    p2 = 0.0;
  } else if (nivelJuego === 2) {
    p1 = 0.8;
    p2 = 0.2;
  } else if (nivelJuego === 3) {
    p1 = 0.6;
    p2 = 0.4;
  } else if (nivelJuego === 4) {
    p1 = 0.4;
    p2 = 0.5; // p3 = 0.1
  } else if (nivelJuego === 5) {
    p1 = 0.3;
    p2 = 0.5; // p3 = 0.2
  } else {
    // Nivel 6 o superior
    p1 = 0.2;
    p2 = 0.5; // p3 = 0.3
  }

  let palabrasSeleccionadas: string[];

  if (rand < p1) {
    palabrasSeleccionadas = DICCIONARIO.nivel1;
  } else if (rand < p1 + p2) {
    palabrasSeleccionadas = DICCIONARIO.nivel2;
  } else {
    palabrasSeleccionadas = DICCIONARIO.nivel3;
  }

  const index = Math.floor(Math.random() * palabrasSeleccionadas.length);
  return palabrasSeleccionadas[index];
}

/**
 * Normaliza caracteres en español para una comparación fluida en teclado.
 * Convierte mayúsculas a minúsculas y elimina tildes y diéresis.
 * Ej: 'Á' -> 'a', 'ü' -> 'u', 'ñ' -> 'ñ'
 */
export function normalizarCaracter(char: string): string {
  const map: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'ü': 'u',
    'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
    'Ü': 'u',
    'Ñ': 'ñ'
  };
  return map[char] || char.toLowerCase();
}

/**
 * Compara dos caracteres para ver si coinciden, considerando acentos de forma tolerante.
 */
export function compararCaracteres(typed: string, target: string): boolean {
  return normalizarCaracter(typed) === normalizarCaracter(target);
}
