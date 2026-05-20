/**
 * Genera docs/Memoria_MyBrAIn.docx
 * Ejecutar: node generate-memoria.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'Memoria_MyBrAIn.docx')

const FONT = 'Calibri'
const BODY = 24 // 12 pt
const TITLE = 28 // 14 pt

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size ?? BODY, bold: opts.bold, italics: opts.italics })
}

function para(children, opts = {}) {
  const ch = typeof children === 'string' ? [run(children)] : children
  return new Paragraph({
    children: ch,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    indent: opts.noIndent ? {} : { firstLine: 360 },
    heading: opts.heading,
  })
}

function h1(text) {
  return para([run(text, { size: TITLE, bold: true })], { heading: HeadingLevel.HEADING_1, noIndent: true, after: 200 })
}

function h2(text) {
  return para([run(text, { size: TITLE, bold: true })], { heading: HeadingLevel.HEADING_2, noIndent: true, after: 160 })
}

function h3(text) {
  return para([run(text, { bold: true })], { heading: HeadingLevel.HEADING_3, noIndent: true, after: 120 })
}

function p(text) {
  return para(text)
}

function bullet(text) {
  return new Paragraph({
    children: [run(`• ${text}`)],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80 },
    indent: { left: 720 },
  })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function tableFromRows(rows, header = true) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, ri) =>
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              children: [new Paragraph({ children: [run(String(c), { bold: header && ri === 0 })] })],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
            })
        ),
      })
    ),
  })
}

function indexLine(level, text) {
  const indent = level === 1 ? 0 : level === 2 ? 360 : 720
  return new Paragraph({
    children: [run(text)],
    spacing: { after: 60 },
    indent: { left: indent },
  })
}

// ——— Índice completo (plantilla) ———
const indexEntries = [
  [1, 'Introducción'],
  [1, '1. Estudio preliminar del proyecto'],
  [2, '1.1. Descripción del sistema'],
  [2, '1.2. Justificación y finalidad del proyecto'],
  [2, '1.3. Objetivos del proyecto'],
  [3, '1.3.1. Objetivos generales'],
  [3, '1.3.2. Objetivos específicos'],
  [2, '1.4. Funcionalidades básicas (visión global por áreas)'],
  [2, '1.5. Viabilidad del sistema (técnica, económica, temporal)'],
  [2, '1.6. Estimación de costes y recursos'],
  [3, '1.6.1. Recursos humanos'],
  [3, '1.6.2. Recursos hardware'],
  [3, '1.6.3. Recursos software'],
  [2, '1.7. Requisitos del sistema'],
  [3, '1.7.1. Requisitos funcionales'],
  [3, '1.7.2. Requisitos no funcionales'],
  [2, '1.8. Actores y casos de uso'],
  [2, '1.9. Prototipos e interfaz'],
  [1, '2. Análisis y diseño de la aplicación'],
  [2, '2.1. Arquitectura del sistema'],
  [3, '2.1.1. Arquitectura cliente-servidor'],
  [3, '2.1.2. Stack tecnológico'],
  [3, '2.1.3. Diagrama de despliegue / componentes'],
  [3, '2.1.4. Comunicación frontend–backend'],
  [2, '2.2. Diseño de datos'],
  [3, '2.2.1. Modelo entidad-relación (ERD)'],
  [3, '2.2.2. Esquema relacional normalizado'],
  [3, '2.2.3. Elección del SGBD'],
  [3, '2.2.4. Implementación física'],
  [3, '2.2.5. Diccionario de datos'],
  [3, '2.2.6. Almacenamiento de tickets'],
  [3, '2.2.7. Restricciones de integridad'],
  [2, '2.3. Diseño funcional'],
  [3, '2.3.1. Diagramas de flujo de datos (DFD)'],
  [3, '2.3.2. Flujos principales'],
  [3, '2.3.3. Diseño de la API REST'],
  [2, '2.4. Integración con inteligencia artificial'],
  [3, '2.4.1. Groq'],
  [3, '2.4.2. Tesseract (OCR)'],
  [3, '2.4.3. Flujo del ticket'],
  [3, '2.4.4. Variables de entorno'],
  [2, '2.5. Seguridad y privacidad'],
  [1, '3. Desarrollo e implementación'],
  [2, '3.1. Estructura del repositorio'],
  [2, '3.2. Backend (Node.js / Express)'],
  [3, '3.2.1–3.2.8. Módulos y servicios IA'],
  [2, '3.3. Frontend (React / Vite)'],
  [3, '3.3.1–3.3.10. Pantallas por módulo'],
  [2, '3.4. Despliegue'],
  [1, '4. Planes e informes de pruebas'],
  [2, '4.1. Plan de pruebas de caja blanca'],
  [2, '4.2. Informe de pruebas de caja blanca'],
  [2, '4.3. Plan de pruebas de caja negra'],
  [2, '4.4. Informe de pruebas de caja negra'],
  [1, '5. Manuales'],
  [2, '5.1. Manual técnico'],
  [2, '5.2. Manual de instalación'],
  [2, '5.3. Manual de usuario'],
  [2, '5.4. Manual de administración'],
  [1, '6. Conclusiones'],
  [2, '6.1. Grado de consecución de los objetivos'],
  [2, '6.2. Aprendizajes y valoración personal'],
  [2, '6.3. Dificultades y soluciones'],
  [2, '6.4. Mejoras futuras'],
  [1, '7. Bibliografía y referencias'],
  [1, 'Anexos (opcional)'],
]

const rfRows = [
  ['ID', 'Nombre', 'Descripción', 'Módulo'],
  ['RF01', 'Inicio de sesión', 'Autenticación con credenciales válidas', 'Auth'],
  ['RF02', 'Cierre de sesión', 'Finalizar sesión de forma segura', 'Auth'],
  ['RF03', 'Consultar perfil', 'Ver datos de la cuenta activa', 'Mi Perfil'],
  ['RF04', 'Dashboard resumen', 'KPIs y accesos a módulos', 'Dashboard'],
  ['RF05', 'Registrar movimiento', 'Alta ingreso/gasto con categoría', 'Finanzas'],
  ['RF06', 'Listar movimientos', 'Consulta por mes y año', 'Finanzas'],
  ['RF07', 'Eliminar movimiento', 'Borrar movimiento del usuario', 'Finanzas'],
  ['RF08', 'Resumen financiero', 'Totales del mes', 'Finanzas'],
  ['RF09', 'Gastos por categoría', 'Desglose mensual', 'Finanzas'],
  ['RF10', 'Gestionar eventos', 'CRUD eventos con fecha', 'Eventos'],
  ['RF11', 'Gestionar huchas', 'Huchas de ahorro', 'Eventos'],
  ['RF12', 'Menú semanal', 'Platos por fecha y momento', 'Alimentación'],
  ['RF13', 'Generar menú con IA', 'Propuesta semanal vía Groq', 'Alimentación / IA'],
  ['RF14', 'Lista de compra', 'Ítems pendientes/comprados', 'Lista compra'],
  ['RF15', 'Lista desde menú', 'Regenerar desde menú semanal', 'Lista / Alimentación'],
  ['RF16', 'Escanear ticket', 'OCR + IA sobre imagen', 'Mis tickets'],
  ['RF17', 'Confirmar ticket', 'Guardar y volcar a Finanzas', 'Mis tickets'],
  ['RF18', 'Consultar tickets', 'Listado y detalle', 'Mis tickets'],
  ['RF19', 'Chat asistente', 'Respuestas contextualizadas', 'Mi Asistente'],
  ['RF20', 'Insights mensuales', 'Comparativa y análisis IA', 'Insights'],
  ['RF21', 'Estado de IA', 'Comprobar disponibilidad Groq', 'Sistema'],
]

const rnfRows = [
  ['ID', 'Tipo', 'Descripción'],
  ['RNF01', 'Seguridad', 'Contraseñas con bcrypt; rutas protegidas'],
  ['RNF02', 'Seguridad', 'GROQ_API_KEY solo en servidor'],
  ['RNF03', 'Usabilidad', 'Navegación lateral y mensajes claros'],
  ['RNF04', 'Usabilidad', 'Indicadores de carga en IA/OCR'],
  ['RNF05', 'Rendimiento', 'Consultas habituales < 2 s en local'],
  ['RNF06', 'Mantenibilidad', 'Separación frontend/backend'],
  ['RNF07', 'Disponibilidad', 'Módulos sin IA operativos sin Groq'],
  ['RNF08', 'Portabilidad', 'Node 18+; SQLite portable'],
  ['RNF09', 'Almacenamiento', 'Límite imagen ticket ~10 MB'],
  ['RNF10', 'Accesibilidad', 'ARIA en formularios y alertas'],
]

const funcRows = [
  ['Área', 'Funcionalidades principales'],
  ['Acceso', 'Login, sesión, perfil, cierre de sesión'],
  ['Dashboard', 'Resumen del mes, accesos, eventos próximos'],
  ['Finanzas', 'Movimientos, resumen, categorías, tickets confirmados'],
  ['Eventos', 'Eventos y huchas de ahorro'],
  ['Alimentación', 'Menú semanal; generación con IA'],
  ['Lista compra', 'Pendientes/comprados; desde menú'],
  ['Mis tickets', 'Escáner OCR+IA; confirmación en Finanzas'],
  ['Mi Asistente', 'Chat con contexto del usuario'],
  ['Insights', 'Comparativa mensual y textos IA'],
]

const children = [
  // PORTADA
  para([run('My_BrAIn', { size: 48, bold: true })], { center: true, noIndent: true, after: 400 }),
  para([run('Plataforma web de gestión personal con inteligencia artificial', { size: TITLE })], {
    center: true,
    noIndent: true,
    after: 600,
  }),
  para([run('Proyecto Integrado — Ciclo Formativo DAW', { size: TITLE })], { center: true, noIndent: true, after: 400 }),
  para([run('[Nombre y apellidos del alumno/a]', { italics: true })], { center: true, noIndent: true, after: 200 }),
  para([run('[Centro educativo]', { italics: true })], { center: true, noIndent: true, after: 200 }),
  para([run('[Fecha de entrega]', { italics: true })], { center: true, noIndent: true, after: 400 }),
  pageBreak(),

  // ÍNDICE
  h1('Índice'),
  p(
    'Nota: En Microsoft Word, selecciona Referencias → Tabla de contenido → Tabla automática para actualizar números de página según los estilos Título 1, 2 y 3.'
  ),
  ...indexEntries.map(([lvl, text]) => indexLine(lvl, text)),
  pageBreak(),

  // INTRODUCCIÓN (plantilla breve)
  h1('Introducción'),
  p(
    'En el presente documento se describe el Proyecto Integrado My_BrAIn, una aplicación web de gestión personal desarrollada en el marco del ciclo de Desarrollo de Aplicaciones Web. La memoria recoge el estudio preliminar, el análisis y diseño, la implementación, las pruebas realizadas y los manuales de uso e instalación.'
  ),
  p(
    'El lector encontrará organizados los apartados según la normativa del módulo: desde la justificación y los requisitos del sistema hasta el detalle técnico de la integración con inteligencia artificial (Groq) y reconocimiento óptico de caracteres (Tesseract) para el escaneo de tickets.'
  ),
  p('[Completar con contexto personal, motivación y estructura del documento.]'),
  pageBreak(),

  // CAPÍTULO 1
  h1('1. Estudio preliminar del proyecto'),

  h2('1.1. Descripción del sistema'),
  p(
    'My_BrAIn es una aplicación web de gestión personal orientada al usuario final que concentra en un único entorno varias áreas de la vida cotidiana: control económico, planificación de comidas, organización de eventos y ahorro, lista de la compra y digitalización de tickets de compra. La solución sigue una arquitectura cliente-servidor: el cliente es una SPA desarrollada con React y Vite; el servidor es una API REST en Node.js con Express, que persiste la información en SQLite y, para las funcionalidades de inteligencia artificial, se comunica con el servicio en la nube Groq.'
  ),
  p(
    'El acceso al sistema está protegido por autenticación (usuario y contraseña). Cada persona dispone de sus propios datos, identificados mediante un usuario_id en base de datos, de modo que finanzas, menús, listas, eventos y tickets no se mezclan entre cuentas.'
  ),
  p(
    'La interfaz se organiza mediante un menú lateral (sidebar) que agrupa los módulos en: área principal (Dashboard), módulos de gestión (Finanzas, Eventos y huchas, Alimentación), módulos con IA (Mi Asistente, Lista de la compra, Insights y alertas, Mis tickets) y sistema (perfil y cierre de sesión). El diseño visual apuesta por un estilo glassmorphism y un fondo tipo aurora en las pantallas protegidas.'
  ),
  p(
    'En resumen, My_BrAIn es un hub personal donde el usuario puede anotar movimientos, planificar la semana, generar listas, escanear tickets con OCR e IA, y consultar un asistente conversacional que responde en función de los datos reales almacenados en la plataforma.'
  ),

  h2('1.2. Justificación y finalidad del proyecto'),
  p(
    'Hoy muchas personas reparten su organización entre varias aplicaciones (banca, notas, calendario, listas en papel, fotos de tickets en la galería). Eso genera dispersión de información y dificultad para obtener una visión global.'
  ),
  p('La finalidad de My_BrAIn es unificar esas necesidades en una sola aplicación web accesible desde el navegador, con dos líneas de valor:'),
  bullet('Gestión estructurada: formularios, tablas, resúmenes y filtros por mes.'),
  bullet('Apoyo mediante IA: menús, análisis de gastos, chat contextual y lectura asistida de tickets.'),
  p(
    'El proyecto se enmarca en el Proyecto Integrado del ciclo DAW, como demostración integrada de competencias profesionales y como herramienta útil y ampliable.'
  ),

  h2('1.3. Objetivos del proyecto'),
  h3('1.3.1. Objetivos generales'),
  bullet('Desarrollar una aplicación web completa de gestión personal, documentada y desplegable.'),
  bullet('Integrar módulos de negocio bajo una misma identidad visual y sistema de login.'),
  bullet('Incorporar IA (Groq) y OCR (Tesseract) donde aporten valor real.'),
  bullet('Garantizar persistencia y aislamiento de datos por usuario.'),
  bullet('Elaborar la memoria según la normativa del centro.'),

  h3('1.3.2. Objetivos específicos'),
  bullet('Implementar registro y consulta de movimientos financieros con categorías y resumen mensual.'),
  bullet('Gestionar eventos y huchas de ahorro vinculadas al módulo económico.'),
  bullet('Planificar menú semanal y lista de la compra con generación asistida.'),
  bullet('Desarrollar escáner de tickets: OCR local, estructuración con IA y volcado a Finanzas.'),
  bullet('Ofrecer chat e insights basados en los datos del usuario.'),
  bullet('Diseñar API REST y frontend React con rutas protegidas.'),
  bullet('Definir requisitos, casos de uso y planes de prueba.'),

  h2('1.4. Funcionalidades básicas (visión global por áreas)'),
  tableFromRows(funcRows),

  h2('1.5. Viabilidad del sistema'),
  p('Viabilidad técnica: Alta. React, Vite, Express y SQLite son tecnologías maduras. Groq y Tesseract.js son integrables. Los riesgos (OCR en fotos malas, límites de API) son mitigables.'),
  p('Viabilidad económica: Baja para uso académico. Software de desarrollo gratuito; Groq con tier gratuito; hosting opcional.'),
  p('Viabilidad temporal: Acotada por módulos ya implementados; ampliaciones futuras no bloquean la entrega del núcleo.'),

  h2('1.6. Estimación de costes y recursos'),
  h3('1.6.1. Recursos humanos'),
  tableFromRows([
    ['Rol', 'Dedicación', 'Observaciones'],
    ['Desarrollador (alumno)', '200–280 h', 'Análisis, desarrollo, pruebas, memoria'],
    ['Tutor PI', '8–12 h', 'Tutorías y revisión'],
  ]),

  h3('1.6.2. Recursos hardware'),
  tableFromRows([
    ['Recurso', 'Especificación', 'Uso'],
    ['PC', '8 GB RAM, SSD', 'IDE, Node, navegador'],
    ['Internet', 'Estable', 'Groq, npm, idiomas OCR'],
    ['Disco', '2–5 GB', 'node_modules, SQLite, tickets'],
  ]),

  h3('1.6.3. Recursos software'),
  tableFromRows([
    ['Recurso', 'Coste'],
    ['Node.js, React, Vite, Express, SQLite', 'Gratuito'],
    ['Groq API', '0 € (tier gratuito) o según uso'],
    ['Tesseract.js', 'Gratuito'],
    ['Git / GitHub Pages', 'Gratuito'],
    ['Word / LibreOffice (memoria)', 'Según licencia'],
  ]),

  h2('1.7. Requisitos del sistema'),
  h3('1.7.1. Requisitos funcionales'),
  tableFromRows(rfRows),
  h3('1.7.2. Requisitos no funcionales'),
  tableFromRows(rnfRows),

  h2('1.8. Actores y casos de uso'),
  p('Actores principales:'),
  bullet('Usuario registrado: usa todos los módulos asociados a su cuenta.'),
  bullet('Visitante: solo accede al login.'),
  bullet('Administrador: en la versión actual el perfil es informativo; no hay panel multi-usuario.'),
  p('Casos de uso principales:'),
  tableFromRows([
    ['UC', 'Caso de uso', 'Descripción'],
    ['UC01', 'Iniciar sesión', 'Validar credenciales'],
    ['UC02', 'Registrar gasto', 'Alta en Finanzas'],
    ['UC03', 'Resumen mensual', 'Ver ingresos y gastos'],
    ['UC06', 'Planificar menú', 'Menú semanal'],
    ['UC08', 'Escanear ticket', 'Foto → OCR → IA → Finanzas'],
    ['UC09', 'Chat asistente', 'Preguntas sobre datos propios'],
    ['UC10', 'Ver insights', 'Análisis comparativo'],
  ]),

  h2('1.9. Prototipos e interfaz'),
  p(
    'La interfaz es una SPA con sidebar (PRINCIPAL, MIS MÓDULOS, INTELIGENCIA ARTIFICIAL, SISTEMA), tarjetas glass, fondo aurora y formularios alineados en rejilla en Finanzas.'
  ),
  p('Capturas recomendadas para la memoria:'),
  bullet('Login, Dashboard, Finanzas, Alimentación, Mis tickets, Mi Asistente, Insights.'),
  p('[Insertar aquí las figuras con pie: Figura 1. Pantalla de…]'),

  pageBreak(),

  // PLANTILLAS capítulos 2–7
  h1('2. Análisis y diseño de la aplicación'),
  p('[Pendiente de redactar: arquitectura, ERD, DFD, API, IA, seguridad.]'),

  h1('3. Desarrollo e implementación'),
  p('[Pendiente de redactar: backend, frontend por módulo, despliegue.]'),

  h1('4. Planes e informes de pruebas'),
  p('[Pendiente de redactar: caja blanca y negra.]'),

  h1('5. Manuales'),
  p('[Pendiente: técnico, instalación, usuario, administración.]'),

  h1('6. Conclusiones'),
  p('[Pendiente: objetivos, aprendizajes, mejoras futuras.]'),

  h1('7. Bibliografía y referencias'),
  p('[Pendiente: React, Express, SQLite, Groq, Tesseract, normativa del centro.]'),
  bullet('Groq. Groq Console — https://console.groq.com/ [fecha de consulta].'),
  bullet('Tesseract.js. Documentación — https://tesseract.projectnaptha.com/ [fecha].'),
]

const doc = new Document({
  creator: 'My_BrAIn',
  title: 'Memoria Proyecto Integrado My_BrAIn',
  styles: {
    default: {
      document: {
        run: { font: FONT, size: BODY },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
})

const buffer = await Packer.toBuffer(doc)
fs.writeFileSync(OUT, buffer)
console.log('Generado:', OUT)
