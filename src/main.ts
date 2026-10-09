import './estilo.css'
import {
  cambiarAsignacion,
  confirmarTurno,
  CONFIG,
  crearEstadoInicial,
  type EstadoJuego,
  type IdentificadorComunidad,
  type Recurso,
} from './logica'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('No se encontró el contenedor principal de la aplicación.')
}

const nombresRecursos: Record<Recurso, string> = {
  agua: 'Agua',
  comida: 'Comida',
  medicina: 'Medicina',
}

const identificadoresComunidad: IdentificadorComunidad[] = ['A', 'B', 'C', 'D']
const recursos: Recurso[] = ['agua', 'comida', 'medicina']
let estado: EstadoJuego | undefined
let comunidadSeleccionada: IdentificadorComunidad = 'A'
let recursoSeleccionado: Recurso = 'agua'
let mensajeEstado = ''

function obtenerEstadoSalud(salud: number): string {
  if (salud <= 20) return 'critica'
  if (salud <= 50) return 'advertencia'
  return 'estable'
}

function obtenerTotalAsignado(recurso: Recurso): number {
  if (!estado) return 0
  return identificadoresComunidad.reduce(
    (total, id) => total + estado!.asignaciones[id][recurso],
    0,
  )
}

function obtenerCambioEsperado(comunidadId: IdentificadorComunidad): number {
  if (!estado) return 0

  const estadoSimulado: EstadoJuego = {
    ...estado,
    inventario: { ...estado.inventario },
    comunidades: estado.comunidades.map((comunidad) => ({ ...comunidad })),
    asignaciones: {
      A: { ...estado.asignaciones.A },
      B: { ...estado.asignaciones.B },
      C: { ...estado.asignaciones.C },
      D: { ...estado.asignaciones.D },
    },
  }
  const saludActual =
    estadoSimulado.comunidades.find(({ id }) => id === comunidadId)?.salud ?? 0

  confirmarTurno(estadoSimulado)

  const saludProyectada =
    estadoSimulado.comunidades.find(({ id }) => id === comunidadId)?.salud ?? 0
  return saludProyectada - saludActual
}

function dibujarBienvenida(): string {
  return `
    <main class="pantalla bienvenida">
      <div class="bienvenida__contenido">
        <p class="sobrelinea">CENTRO DE COORDINACIÓN DE EMERGENCIAS</p>
        <div class="insignia" aria-hidden="true">RJ</div>
        <h1>Reparto Justo:<br><span>Gestión de Crisis</span></h1>
        <p class="bienvenida__texto">
          Distribuye agua, comida y medicinas entre cuatro comunidades.
          Cada decisión cuenta para mantenerlas a salvo durante siete días.
        </p>
        <button class="boton boton--principal boton--grande" data-accion="iniciar">
          Iniciar gestión
        </button>
        <p class="ayuda-teclado">También puedes usar 1–4, las flechas y Enter.</p>
      </div>
    </main>
  `
}

function dibujarInventario(): string {
  if (!estado) return ''

  return recursos
    .map((recurso) => {
      const disponible = estado!.inventario[recurso] - obtenerTotalAsignado(recurso)
      const seleccionado = recursoSeleccionado === recurso
      return `
        <button
          class="recurso recurso--${recurso}${seleccionado ? ' recurso--seleccionado' : ''}"
          data-accion="seleccionar-recurso"
          data-recurso="${recurso}"
          aria-pressed="${seleccionado}"
        >
          <span class="recurso__nombre">${nombresRecursos[recurso]}</span>
          <strong class="recurso__cantidad">${disponible}</strong>
          <span class="recurso__unidad">disponibles</span>
        </button>
      `
    })
    .join('')
}

function dibujarControlesRecurso(
  comunidadId: IdentificadorComunidad,
  recurso: Recurso,
): string {
  if (!estado) return ''
  const cantidad = estado.asignaciones[comunidadId][recurso]
  const asignadoTotal = obtenerTotalAsignado(recurso)
  const noHayDisponibles = asignadoTotal >= estado.inventario[recurso]

  return `
    <div class="control-recurso control-recurso--${recurso}">
      <span class="control-recurso__nombre">${nombresRecursos[recurso]}</span>
      <div class="control-recurso__acciones">
        <button
          class="boton-cantidad"
          data-accion="cambiar-asignacion"
          data-comunidad="${comunidadId}"
          data-recurso="${recurso}"
          data-cambio="-1"
          aria-label="Quitar una unidad de ${nombresRecursos[recurso]} para ${estado.comunidades.find(({ id }) => id === comunidadId)?.nombre}"
          ${cantidad === 0 ? 'disabled' : ''}
        >−</button>
        <output aria-label="${nombresRecursos[recurso]} asignada">${cantidad}</output>
        <button
          class="boton-cantidad"
          data-accion="cambiar-asignacion"
          data-comunidad="${comunidadId}"
          data-recurso="${recurso}"
          data-cambio="1"
          aria-label="Asignar una unidad de ${nombresRecursos[recurso]} a ${estado.comunidades.find(({ id }) => id === comunidadId)?.nombre}"
          ${noHayDisponibles ? 'disabled' : ''}
        >+</button>
      </div>
    </div>
  `
}

function dibujarComunidad(comunidadId: IdentificadorComunidad): string {
  if (!estado) return ''
  const comunidad = estado.comunidades.find(({ id }) => id === comunidadId)
  if (!comunidad) return ''

  const saludEstado = obtenerEstadoSalud(comunidad.salud)
  const seleccionada = comunidadSeleccionada === comunidadId
  const cambioEsperado = obtenerCambioEsperado(comunidadId)
  const cambioFormateado =
    cambioEsperado > 0 ? `+${cambioEsperado}` : `${cambioEsperado}`

  return `
    <article class="tarjeta-comunidad tarjeta-comunidad--${saludEstado}${seleccionada ? ' tarjeta-comunidad--seleccionada' : ''}${comunidad.salud <= CONFIG.SALUD_MINIMA_VICTORIA ? ' tarjeta-comunidad--alerta-critica' : ''}">
      <div class="tarjeta-comunidad__encabezado">
        <div>
          <p class="tarjeta-comunidad__identificador">COMUNIDAD ${comunidad.id}</p>
          <h3>${comunidad.nombre}</h3>
        </div>
        <button
          class="boton-seleccionar${seleccionada ? ' boton-seleccionar--activo' : ''}"
          data-accion="seleccionar-comunidad"
          data-comunidad="${comunidad.id}"
          aria-pressed="${seleccionada}"
        >${seleccionada ? 'Seleccionada' : 'Seleccionar'}</button>
      </div>
      <div class="salud">
        <div class="salud__etiquetas">
          <span>Salud</span>
          <strong>${comunidad.salud}%</strong>
        </div>
        <div
          class="barra-salud"
          role="progressbar"
          aria-label="Salud de ${comunidad.nombre}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${comunidad.salud}"
        >
          <span class="barra-salud__relleno" style="width: ${comunidad.salud}%"></span>
        </div>
        <span class="estado-salud estado-salud--${saludEstado}">
          ${saludEstado === 'estable' ? 'Estable' : saludEstado === 'advertencia' ? 'Advertencia' : 'Crítica'}
        </span>
        <p class="cambio-esperado cambio-esperado--${cambioEsperado > 0 ? 'positivo' : cambioEsperado < 0 ? 'negativo' : 'neutro'}">
          Cambio esperado: <strong>${cambioFormateado}%</strong>
        </p>
      </div>
      <div class="asignaciones" aria-label="Asignación de recursos para ${comunidad.nombre}">
        ${recursos.map((recurso) => dibujarControlesRecurso(comunidad.id, recurso)).join('')}
      </div>
    </article>
  `
}

function dibujarPanel(): string {
  if (!estado) return dibujarBienvenida()

  return `
    <main class="pantalla panel">
      <header class="barra-superior">
        <a class="marca" href="#" data-accion="bienvenida" aria-label="Volver a la bienvenida">
          <span class="marca__simbolo" aria-hidden="true">RJ</span>
          <span>Reparto Justo</span>
        </a>
        <div class="contador-dia" aria-label="Día ${estado.dia} de 7">
          <span>DÍA</span>
          <strong>${estado.dia}</strong>
          <span>DE 7</span>
        </div>
      </header>

      <section class="panel__contenido">
        <div class="titulo-seccion">
          <div>
            <p class="sobrelinea">GESTIÓN DE CRISIS</p>
            <h1>Distribución de recursos</h1>
            <p>Selecciona una comunidad y asigna los recursos disponibles.</p>
          </div>
        </div>

        <section class="inventario" aria-labelledby="titulo-inventario">
          <div class="inventario__encabezado">
            <h2 id="titulo-inventario">Inventario global</h2>
            <span>Unidades disponibles</span>
          </div>
          <div class="inventario__recursos">${dibujarInventario()}</div>
        </section>

        <section class="comunidades" aria-labelledby="titulo-comunidades">
          <div class="seccion__encabezado">
            <div>
              <h2 id="titulo-comunidades">Comunidades</h2>
              <p>Usa + y − para preparar las asignaciones de hoy.</p>
            </div>
            <p class="recurso-activo">Recurso seleccionado: <strong>${nombresRecursos[recursoSeleccionado]}</strong></p>
          </div>
          <div class="rejilla-comunidades">
            ${identificadoresComunidad.map(dibujarComunidad).join('')}
          </div>
        </section>

        <div class="pie-acciones">
          <p class="ayuda-controles">Teclado: 1–4 elige comunidad · ↑/↓ asigna o retira · Enter confirma</p>
          <button class="boton boton--principal boton--enviar" data-accion="confirmar">
            Enviar y avanzar turno <span aria-hidden="true">→</span>
          </button>
        </div>
        <p class="mensaje-estado" role="status" aria-live="polite">${mensajeEstado}</p>
      </section>
    </main>
  `
}

function dibujarFinal(): string {
  if (!estado) return dibujarBienvenida()
  const victoria = estado.resultado === 'victoria'

  return `
    <main class="pantalla pantalla-final ${victoria ? 'pantalla-final--victoria' : 'pantalla-final--derrota'}">
      <div class="pantalla-final__contenido">
        <p class="sobrelinea">GESTIÓN DE CRISIS · DÍA ${estado.dia} DE 7</p>
        <div class="final-simbolo" aria-hidden="true">${victoria ? '✓' : '!'}</div>
        <h1>${victoria ? '¡Misión cumplida!' : 'La crisis ha vencido'}</h1>
        <p>
          ${victoria
            ? 'Las cuatro comunidades llegaron al final con más del 20% de salud. Tu distribución mantuvo a todas a salvo.'
            : 'Una comunidad llegó a 0% de salud o no superó el 20% al finalizar el séptimo día.'}
        </p>
        <div class="resumen-final" aria-label="Salud final de las comunidades">
          ${estado.comunidades
            .map(
              (comunidad) => `
                <div class="resumen-final__comunidad${comunidad.salud <= CONFIG.SALUD_MINIMA_VICTORIA ? ' tarjeta-comunidad--alerta-critica' : ''}">
                  <span>${comunidad.nombre}</span>
                  <strong>${comunidad.salud}%</strong>
                </div>
              `,
            )
            .join('')}
        </div>
        <button class="boton boton--principal boton--grande" data-accion="reiniciar">
          Jugar de nuevo
        </button>
      </div>
    </main>
  `
}

function dibujar(): void {
  if (!estado) {
    app!.innerHTML = dibujarBienvenida()
  } else if (estado.resultado !== 'enCurso') {
    app!.innerHTML = dibujarFinal()
  } else {
    app!.innerHTML = dibujarPanel()
  }
}

function esComunidad(value: string | undefined): value is IdentificadorComunidad {
  return identificadoresComunidad.includes(value as IdentificadorComunidad)
}

function esRecurso(value: string | undefined): value is Recurso {
  return recursos.includes(value as Recurso)
}

function cambiarCantidad(comunidad: IdentificadorComunidad, cambio: number): void {
  if (!estado) return
  const valido = cambiarAsignacion(estado, comunidad, recursoSeleccionado, cambio)
  mensajeEstado = valido
    ? `${nombresRecursos[recursoSeleccionado]} actualizado para ${estado.comunidades.find(({ id }) => id === comunidad)?.nombre}.`
    : `No hay unidades suficientes de ${nombresRecursos[recursoSeleccionado]} para esa asignación.`
  dibujar()
}

function confirmar(): void {
  if (!estado) return
  const comunidadesEnRiesgo = new Set(
    estado.comunidades
      .filter(({ salud }) => salud > CONFIG.SALUD_MINIMA_VICTORIA)
      .map(({ id }) => id),
  )
  const valido = confirmarTurno(estado)
  const entroEnEstadoCritico =
    valido &&
    estado.comunidades.some(
      ({ id, salud }) =>
        comunidadesEnRiesgo.has(id) &&
        salud <= CONFIG.SALUD_MINIMA_VICTORIA,
    )

  if (entroEnEstadoCritico && typeof navigator.vibrate === 'function') {
    navigator.vibrate(80)
  }

  mensajeEstado = valido ? '' : 'No se pudo confirmar el turno.'
  dibujar()
}

app.addEventListener('click', (evento: MouseEvent) => {
  const objetivo = evento.target
  if (!(objetivo instanceof Element)) return
  const boton = objetivo.closest<HTMLElement>('[data-accion]')
  if (!boton) return

  if (boton instanceof HTMLButtonElement && typeof navigator.vibrate === 'function') {
    navigator.vibrate(50)
  }

  const accion = boton.dataset.accion
  if (accion === 'iniciar') {
    estado = crearEstadoInicial()
    comunidadSeleccionada = 'A'
    recursoSeleccionado = 'agua'
    mensajeEstado = ''
  } else if (accion === 'bienvenida') {
    evento.preventDefault()
    estado = undefined
    mensajeEstado = ''
  } else if (accion === 'reiniciar') {
    estado = crearEstadoInicial()
    comunidadSeleccionada = 'A'
    recursoSeleccionado = 'agua'
    mensajeEstado = ''
  } else if (accion === 'seleccionar-comunidad' && esComunidad(boton.dataset.comunidad)) {
    comunidadSeleccionada = boton.dataset.comunidad
    mensajeEstado = `Seleccionaste ${estado?.comunidades.find(({ id }) => id === comunidadSeleccionada)?.nombre}.`
  } else if (accion === 'seleccionar-recurso' && esRecurso(boton.dataset.recurso)) {
    recursoSeleccionado = boton.dataset.recurso
    mensajeEstado = `Recurso seleccionado: ${nombresRecursos[recursoSeleccionado]}.`
  } else if (
    accion === 'cambiar-asignacion' &&
    esComunidad(boton.dataset.comunidad) &&
    esRecurso(boton.dataset.recurso)
  ) {
    recursoSeleccionado = boton.dataset.recurso
    comunidadSeleccionada = boton.dataset.comunidad
    cambiarCantidad(boton.dataset.comunidad, Number(boton.dataset.cambio))
    return
  } else if (accion === 'confirmar') {
    confirmar()
    return
  }

  dibujar()
})

window.addEventListener('keydown', (evento: KeyboardEvent) => {
  if (
    evento.key === 'Enter' &&
    evento.target instanceof Element &&
    evento.target.closest('button, a, input, select, textarea')
  ) {
    return
  }

  if (!estado) {
    if (evento.key === 'Enter') {
      estado = crearEstadoInicial()
      mensajeEstado = ''
      dibujar()
    }
    return
  }

  if (estado.resultado !== 'enCurso') {
    if (evento.key === 'Enter') {
      estado = crearEstadoInicial()
      comunidadSeleccionada = 'A'
      recursoSeleccionado = 'agua'
      dibujar()
    }
    return
  }

  if (evento.key >= '1' && evento.key <= '4') {
    comunidadSeleccionada = identificadoresComunidad[Number(evento.key) - 1]
    mensajeEstado = `Seleccionaste ${estado.comunidades.find(({ id }) => id === comunidadSeleccionada)?.nombre}.`
    dibujar()
  } else if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
    evento.preventDefault()
    cambiarCantidad(comunidadSeleccionada, evento.key === 'ArrowUp' ? 1 : -1)
  } else if (evento.key === 'Enter') {
    evento.preventDefault()
    confirmar()
  }
})

dibujar()
