import { describe, expect, it } from 'vitest'
import {
  cambiarAsignacion,
  CONFIG,
  confirmarTurno,
  crearEstadoInicial,
  type EstadoJuego,
  type IdentificadorComunidad,
  type Recurso,
} from '../src/logica'

function calcularSaludAlConfirmar(
  estado: EstadoJuego,
  comunidadId: IdentificadorComunidad,
  asignaciones = estado.asignaciones[comunidadId],
): number {
  const comunidad = estado.comunidades.find(({ id }) => id === comunidadId)!
  const recibioMedicina = asignaciones.medicina > 0
  const recuperacion =
    asignaciones.agua * CONFIG.RECUPERACION_AGUA +
    asignaciones.comida * CONFIG.RECUPERACION_COMIDA +
    asignaciones.medicina * CONFIG.RECUPERACION_MEDICINA
  const saludTrasRecursos = Math.min(
    CONFIG.SALUD_MAXIMA,
    comunidad.salud + recuperacion,
  )
  const desgasteCritico =
    saludTrasRecursos < CONFIG.SALUD_UMBRAL_CRITICO && !recibioMedicina
      ? CONFIG.DESGASTE_CRITICO_MEDICINA
      : 0

  return Math.max(
    0,
    saludTrasRecursos - CONFIG.DESGASTE_DIARIO_BASE - desgasteCritico,
  )
}

function ordenarSaludAscendente(salud: number[]): number[] {
  return [...salud].sort((a, b) => a - b)
}

function compararSalud(a: number[], b: number[]): number {
  for (let indice = 0; indice < a.length; indice += 1) {
    if (a[indice] !== b[indice]) return a[indice] - b[indice]
  }

  return 0
}

function reforzarComunidadesMasVulnerables(estado: EstadoJuego): void {
  const comunidades: IdentificadorComunidad[] = ['A', 'B', 'C', 'D']
  const recursos: Recurso[] = ['medicina', 'comida', 'agua']

  while (true) {
    const saludActual = ordenarSaludAscendente(
      comunidades.map((id) => calcularSaludAlConfirmar(estado, id)),
    )
    if (saludActual[0] >= 40) return

    let mejorOpcion:
      | {
          comunidad: IdentificadorComunidad
          recurso: Recurso
          salud: number[]
        }
      | undefined

    for (const comunidad of comunidades) {
      for (const recurso of recursos) {
        const disponible = estado.inventario[recurso]
        const asignadoTotal = comunidades.reduce(
          (total, id) => total + estado.asignaciones[id][recurso],
          0,
        )
        if (asignadoTotal >= disponible) continue

        const asignaciones = {
          ...estado.asignaciones[comunidad],
          [recurso]: estado.asignaciones[comunidad][recurso] + 1,
        }
        const salud = ordenarSaludAscendente(
          comunidades.map((id) =>
            calcularSaludAlConfirmar(
              estado,
              id,
              id === comunidad ? asignaciones : undefined,
            ),
          ),
        )

        if (!mejorOpcion || compararSalud(salud, mejorOpcion.salud) > 0) {
          mejorOpcion = { comunidad, recurso, salud }
        }
      }
    }

    if (!mejorOpcion) return
    expect(
      cambiarAsignacion(estado, mejorOpcion.comunidad, mejorOpcion.recurso, 1),
    ).toBe(true)
  }
}

describe('La lógica de Reparto Justo', () => {
  it('arma las cuatro comunidades con salud e inventario inicial correctos', () => {
    const estado = crearEstadoInicial()

    expect(estado.dia).toBe(1)
    expect(estado.resultado).toBe('enCurso')
    expect(estado.comunidades).toEqual([
      { id: 'A', nombre: 'San José', salud: CONFIG.SALUD_INICIAL_A },
      { id: 'B', nombre: 'El Rosal', salud: CONFIG.SALUD_INICIAL_B },
      { id: 'C', nombre: 'La Paz', salud: CONFIG.SALUD_INICIAL_C },
      { id: 'D', nombre: 'Esperanza', salud: CONFIG.SALUD_INICIAL_D },
    ])
    expect(estado.inventario).toEqual({
      agua: CONFIG.AGUA_INICIAL,
      comida: CONFIG.COMIDA_INICIAL,
      medicina: CONFIG.MEDICINA_INICIAL,
    })
    expect(Object.values(estado.asignaciones).flatMap(Object.values)).toEqual(
      Array(12).fill(0),
    )
  })

  it('acepta una asignación válida y permite retirarla', () => {
    const estado = crearEstadoInicial()

    expect(cambiarAsignacion(estado, 'A', 'agua', 2)).toBe(true)
    expect(estado.asignaciones.A.agua).toBe(2)
    expect(cambiarAsignacion(estado, 'A', 'agua', -1)).toBe(true)
    expect(estado.asignaciones.A.agua).toBe(1)
  })

  it('rechaza cambios nulos, fraccionarios, negativos o superiores al inventario', () => {
    const estado = crearEstadoInicial()

    expect(cambiarAsignacion(estado, 'A', 'agua', 0)).toBe(false)
    expect(cambiarAsignacion(estado, 'A', 'agua', 0.5)).toBe(false)
    expect(cambiarAsignacion(estado, 'A', 'agua', -1)).toBe(false)
    expect(cambiarAsignacion(estado, 'A', 'agua', CONFIG.AGUA_INICIAL + 1)).toBe(
      false,
    )
    expect(estado.asignaciones.A.agua).toBe(0)
  })

  it('consume los recursos asignados, recupera salud y avanza al día siguiente', () => {
    const estado = crearEstadoInicial()

    expect(cambiarAsignacion(estado, 'A', 'agua', 2)).toBe(true)
    expect(cambiarAsignacion(estado, 'B', 'comida', 1)).toBe(true)
    expect(cambiarAsignacion(estado, 'C', 'medicina', 1)).toBe(true)
    expect(confirmarTurno(estado)).toBe(true)

    expect(estado.inventario).toEqual({ agua: 18, comida: 15, medicina: 7 })
    expect(estado.comunidades.map(({ salud }) => salud)).toEqual([75, 60, 60, 65])
    expect(estado.dia).toBe(2)
    expect(estado.resultado).toBe('enCurso')
    expect(Object.values(estado.asignaciones).flatMap(Object.values)).toEqual(
      Array(12).fill(0),
    )
  })

  it('rechaza asignar o confirmar acciones después de terminar la partida', () => {
    const estado = crearEstadoInicial()
    estado.resultado = 'victoria'

    expect(cambiarAsignacion(estado, 'A', 'agua', 1)).toBe(false)
    expect(confirmarTurno(estado)).toBe(false)
    expect(estado.asignaciones.A.agua).toBe(0)
    expect(estado.dia).toBe(1)
  })

  it('declara victoria al completar el día 7 con todas las comunidades por encima del 20%', () => {
    const estado = crearEstadoInicial()
    estado.dia = CONFIG.DIAS_TOTALES
    estado.comunidades.forEach((comunidad) => {
      comunidad.salud = 60
    })

    expect(confirmarTurno(estado)).toBe(true)
    expect(estado.resultado).toBe('victoria')
    expect(estado.comunidades.every(
      ({ salud }) => salud > CONFIG.SALUD_MINIMA_VICTORIA,
    )).toBe(true)
  })

  it('declara derrota si una comunidad llega a cero o no supera el 20% al final del día 7', () => {
    const derrotaPorCero = crearEstadoInicial()
    derrotaPorCero.comunidades[0].salud = 15

    expect(confirmarTurno(derrotaPorCero)).toBe(true)
    expect(derrotaPorCero.comunidades[0].salud).toBe(0)
    expect(derrotaPorCero.resultado).toBe('derrota')
    expect(derrotaPorCero.dia).toBe(1)

    const derrotaAlFinal = crearEstadoInicial()
    derrotaAlFinal.dia = CONFIG.DIAS_TOTALES
    derrotaAlFinal.comunidades.forEach((comunidad) => {
      comunidad.salud = 35
    })

    expect(confirmarTurno(derrotaAlFinal)).toBe(true)
    expect(derrotaAlFinal.comunidades.every(({ salud }) => salud > 0)).toBe(true)
    expect(derrotaAlFinal.comunidades[0].salud).toBe(10)
    expect(derrotaAlFinal.resultado).toBe('derrota')
  })

  it('permite jugar desde el día 1 hasta la victoria en el día 7', () => {
    const estado = crearEstadoInicial()

    expect(cambiarAsignacion(estado, 'A', 'agua', 2)).toBe(true)
    expect(cambiarAsignacion(estado, 'B', 'comida', 1)).toBe(true)
    expect(cambiarAsignacion(estado, 'C', 'medicina', 1)).toBe(true)
    expect(confirmarTurno(estado)).toBe(true)

    while (estado.resultado === 'enCurso') {
      reforzarComunidadesMasVulnerables(estado)
      expect(confirmarTurno(estado)).toBe(true)
    }

    expect(estado.dia).toBe(CONFIG.DIAS_TOTALES)
    expect(estado.resultado).toBe('victoria')
    expect(
      estado.comunidades.every(
        ({ salud }) => salud > CONFIG.SALUD_MINIMA_VICTORIA,
      ),
    ).toBe(true)
  })
})
