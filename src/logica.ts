export const CONFIG = {
  DIAS_TOTALES: 7, // días consecutivos sin caer para ganar (días)
  SALUD_INICIAL_A: 70, // salud de San José (porcentaje)
  SALUD_INICIAL_B: 60, // salud de El Rosal (porcentaje)
  SALUD_INICIAL_C: 50, // salud de La Paz (porcentaje)
  SALUD_INICIAL_D: 80, // salud de Esperanza (porcentaje)
  SALUD_MINIMA_VICTORIA: 20, // salud mínima por comunidad al finalizar el día 7 (porcentaje)
  SALUD_UMBRAL_CRITICO: 40, // umbral para aplicar desgaste crítico (porcentaje)
  SALUD_MAXIMA: 100, // salud máxima de una comunidad (porcentaje)
  DESGASTE_DIARIO_BASE: 15, // pérdida de salud por turno si no reciben recursos (porcentaje/día)
  DESGASTE_CRITICO_MEDICINA: 10, // pérdida extra si la salud baja de 40% sin recibir medicina (porcentaje/día)
  AGUA_INICIAL: 20, // unidades globales disponibles (unidades)
  COMIDA_INICIAL: 16, // unidades globales disponibles (unidades)
  MEDICINA_INICIAL: 8, // unidades globales disponibles (unidades)
  RECUPERACION_AGUA: 10, // salud ganada por unidad de agua (porcentaje/unidad)
  RECUPERACION_COMIDA: 15, // salud ganada por unidad de comida (porcentaje/unidad)
  RECUPERACION_MEDICINA: 25, // salud ganada por unidad de medicina (porcentaje/unidad)
} as const

export type Recurso = 'agua' | 'comida' | 'medicina'
export type IdentificadorComunidad = 'A' | 'B' | 'C' | 'D'
export type ResultadoJuego = 'enCurso' | 'victoria' | 'derrota'

export type Inventario = Record<Recurso, number>

export interface Comunidad {
  id: IdentificadorComunidad
  nombre: string
  salud: number
}

export interface AsignacionesComunidad {
  agua: number
  comida: number
  medicina: number
}

export interface EstadoJuego {
  dia: number
  resultado: ResultadoJuego
  inventario: Inventario
  comunidades: Comunidad[]
  asignaciones: Record<IdentificadorComunidad, AsignacionesComunidad>
}

export function crearEstadoInicial(): EstadoJuego {
  return {
    dia: 1,
    resultado: 'enCurso',
    inventario: {
      agua: CONFIG.AGUA_INICIAL,
      comida: CONFIG.COMIDA_INICIAL,
      medicina: CONFIG.MEDICINA_INICIAL,
    },
    comunidades: [
      { id: 'A', nombre: 'San José', salud: CONFIG.SALUD_INICIAL_A },
      { id: 'B', nombre: 'El Rosal', salud: CONFIG.SALUD_INICIAL_B },
      { id: 'C', nombre: 'La Paz', salud: CONFIG.SALUD_INICIAL_C },
      { id: 'D', nombre: 'Esperanza', salud: CONFIG.SALUD_INICIAL_D },
    ],
    asignaciones: {
      A: { agua: 0, comida: 0, medicina: 0 },
      B: { agua: 0, comida: 0, medicina: 0 },
      C: { agua: 0, comida: 0, medicina: 0 },
      D: { agua: 0, comida: 0, medicina: 0 },
    },
  }
}

export function cambiarAsignacion(
  estado: EstadoJuego,
  comunidadId: IdentificadorComunidad,
  recurso: Recurso,
  cambio: number,
): boolean {
  if (
    estado.resultado !== 'enCurso' ||
    !Number.isInteger(cambio) ||
    cambio === 0 ||
    !estado.asignaciones[comunidadId]
  ) {
    return false
  }

  const asignado = estado.asignaciones[comunidadId][recurso]
  const nuevoAsignado = asignado + cambio
  if (nuevoAsignado < 0) return false

  const totalAsignado = Object.values(estado.asignaciones).reduce(
    (total, asignacion) => total + asignacion[recurso],
    0,
  )
  if (totalAsignado + cambio > estado.inventario[recurso]) return false

  estado.asignaciones[comunidadId][recurso] = nuevoAsignado
  return true
}

export function confirmarTurno(estado: EstadoJuego): boolean {
  if (estado.resultado !== 'enCurso') return false

  for (const comunidad of estado.comunidades) {
    const asignacion = estado.asignaciones[comunidad.id]
    const recibioMedicina = asignacion.medicina > 0
    const recuperacion =
      asignacion.agua * CONFIG.RECUPERACION_AGUA +
      asignacion.comida * CONFIG.RECUPERACION_COMIDA +
      asignacion.medicina * CONFIG.RECUPERACION_MEDICINA
    const saludTrasRecursos = Math.min(
      CONFIG.SALUD_MAXIMA,
      comunidad.salud + recuperacion,
    )
    const desgasteCritico =
      saludTrasRecursos < CONFIG.SALUD_UMBRAL_CRITICO && !recibioMedicina
        ? CONFIG.DESGASTE_CRITICO_MEDICINA
        : 0

    comunidad.salud = Math.max(
      0,
      saludTrasRecursos - CONFIG.DESGASTE_DIARIO_BASE - desgasteCritico,
    )
  }

  for (const recurso of ['agua', 'comida', 'medicina'] as const) {
    const consumido = Object.values(estado.asignaciones).reduce(
      (total, asignacion) => total + asignacion[recurso],
      0,
    )
    estado.inventario[recurso] -= consumido
  }

  for (const id of ['A', 'B', 'C', 'D'] as const) {
    estado.asignaciones[id] = { agua: 0, comida: 0, medicina: 0 }
  }

  if (estado.comunidades.some((comunidad) => comunidad.salud === 0)) {
    estado.resultado = 'derrota'
    return true
  }

  if (estado.dia === CONFIG.DIAS_TOTALES) {
    estado.resultado = estado.comunidades.every(
      (comunidad) => comunidad.salud > CONFIG.SALUD_MINIMA_VICTORIA,
    )
      ? 'victoria'
      : 'derrota'
    return true
  }

  estado.dia += 1
  return true
}
