<div align="center">

<img src="assets/icon.png" alt="Garlic" width="96">

# Garlic

**Convierte, edita y organiza archivos desde una pequeña rueda que se abre junto a cualquier archivo.**

Mantén una tecla, haz clic sobre un archivo y elige a qué formato convertirlo, qué herramienta usar o qué hacer con él.

[English](README.en.md) · Español

<img src="docs/img/wheel-convert.png" alt="La rueda de Garlic junto a un archivo" width="300">

</div>

> **Estado:** versión 1.0 · probada en **Windows 10/11**. macOS está implementado pero **sin probar** y Linux funciona **sin el atajo de clic** (ver [Compatibilidad](#compatibilidad-por-sistema)).
> Garlic es una aplicación independiente, inspirada en la idea de [Tangerine para Mac](https://tangerineformac.com/); no tiene relación con ella ni comparte código ni diseño.

---

## Contenido

- [Qué hace](#qué-hace)
- [Cómo se usa](#cómo-se-usa)
- [Instalación](#instalación) — zip portable · desde el código (CMD / PowerShell / Bash) · carpeta portable · línea de comandos
- [Compatibilidad por sistema](#compatibilidad-por-sistema)
- [Formatos](#formatos)
- [Ajustes y personalización](#ajustes-y-personalización)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Desarrollo](#desarrollo)
- [Solución de problemas](#solución-de-problemas)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Licencia y créditos](#licencia-y-créditos)

## Qué hace

| | |
|---|---|
| **Convertir** | Más de 60 conversiones: imágenes, PDF, Word, PowerPoint, Markdown, HTML, EPUB, hojas de cálculo, subtítulos, audio, vídeo y archivos comprimidos. Los PDF de Markdown/HTML/Word/PowerPoint se renderizan con Chromium, así que conservan imágenes, tablas, colores y diseño. |
| **Editar** | Imágenes: recortar, quitar fondo (automático, varita y borrador), añadir fondo, comprimir, ajustar, censurar, anotar y ver metadatos. Audio: comprimir, normalizar, canales, cortar, forma de onda. Vídeo: comprimir, cortar, encuadre, velocidad, silenciar, captura, dividir. |
| **Acciones** | Para *cualquier* archivo o carpeta: copiar ruta, mostrar, abrir, terminal aquí, copiar o mover a… Las carpetas se pueden comprimir a ZIP/TAR/TGZ. |
| **Progreso** | Una tarjeta flotante muestra la barra y el porcentaje (real en audio/vídeo) y, al terminar, te deja **Mostrar**, **Abrir** o **Mover a…** el archivo nuevo. |
| **Editor** | Ventana propia que se puede mover, redimensionar y **hacer zoom** (Ctrl + rueda, botones, Ctrl +/−/0/1), con desplazamiento (rueda, botón central, barra espaciadora). |
| **Interfaz** | Español e inglés, tema oscuro/claro/automático, efecto cristal, acentos y opacidad personalizables, sonidos opcionales. |

<p align="center"><img src="docs/img/app-home-dark.png" alt="Ventana principal" width="720"></p>

## Cómo se usa

1. Abre Garlic. Se queda en la **bandeja del sistema**.
2. En el explorador de archivos, mantén **Alt** y haz **clic izquierdo** sobre un archivo (la combinación se cambia en *Atajo*).
3. La rueda aparece junto al archivo. Pasa el cursor para ver qué hará cada opción («convertir a PNG») y haz clic.
4. Cambia de modo con **‹ ›**, las flechas del teclado o la rueda del ratón: **Convertir → Editar → Acciones**.
5. Cierra la rueda con un clic fuera, **Esc** o dejándola unos segundos.

También puedes soltar un archivo en la ventana, usar **Elegir archivo…** o abrirlo desde la línea de comandos (`garlic archivo.pdf`).

<p align="center"><img src="docs/img/editor-crop-zoom.png" alt="Editor con zoom" width="560">&nbsp;<img src="docs/img/job-cards.png" alt="Tarjetas de progreso" width="360"></p>

## Instalación

### Requisitos

- **Node.js 20 o superior** (solo para las opciones B, C y D; no hace falta con el zip de la Opción A) — <https://nodejs.org>
- Conexión a internet **durante la instalación** (se descargan Electron y ffmpeg); después funciona sin conexión.
- Windows 10/11 (ver [compatibilidad](#compatibilidad-por-sistema) para otros sistemas).

### Opción A — Descargar el zip portable (Windows, sin instalar Node.js)

1. Abre la página de **Releases** del repositorio: <https://github.com/Sltcrd/garlic/releases/latest>
2. Descarga **`Garlic-win32-x64.zip`** (en *Assets*).
3. Haz clic derecho sobre el zip → **Propiedades** → marca **Desbloquear** → Aceptar (así Windows no marca los archivos como descargados de internet).
4. **Extrae todo** el contenido en una carpeta, por ejemplo `C:Garlic` (no ejecutes desde dentro del zip).
5. Haz doble clic en **`Garlic.vbs`** (o `Garlic.bat`). Garlic aparece en la bandeja del sistema.

> **Windows muestra «Windows protegió tu PC» (SmartScreen):** pulsa *Más información → Ejecutar de todos modos*. Pasa porque el programa no está firmado con un certificado de pago, no porque sea peligroso; el código completo es público y puedes compilarlo tú mismo (Opción B). Si el Control Inteligente de Aplicaciones bloquea el `.exe`, usa la Opción B.
>
> **Licencias:** el zip incluye ffmpeg (GPL). Su código fuente: <https://ffmpeg.org> y <https://github.com/eugeneware/ffmpeg-static>. Más en `THIRD_PARTY_NOTICES.md`.

### Opción B — Desde el código

**CMD**

```bat
git clone https://github.com/Sltcrd/garlic.git
cd garlic
npm install
npm start
```

**PowerShell**

```powershell
git clone https://github.com/Sltcrd/garlic.git
Set-Location garlic
npm install
npm start
```

**Bash (macOS / Linux / Git Bash)**

```bash
git clone https://github.com/Sltcrd/garlic.git
cd garlic
npm install
npm start
```

`npm install` descarga Electron, ffmpeg y las demás dependencias (≈ 600 MB). Si falla la descarga de Electron, ejecuta `node node_modules/electron/install.js` y repite `npm start`.

Para arrancar **oculto en la bandeja**: `npm run start:hidden`.

### Opción C — Generar tu propia carpeta portable (opcional)

```bash
npm install
npm run package          # crea out/Garlic-<sistema>-<arquitectura>/
npm run package:zip      # además crea el .zip
```

En Windows ejecuta `out\Garlic-win32-x64\Garlic.vbs`.

> **Windows pide confirmación / Control Inteligente de Aplicaciones:** la carpeta usa el `electron.exe` oficial sin modificar, que Windows suele permitir. Si SmartScreen avisa, elige *Más información → Ejecutar de todos modos*. Los binarios no están firmados digitalmente (la firma requiere un certificado de pago).

### Opción D — Línea de comandos

```bash
npm install -g .         # desde la carpeta del proyecto
garlic                   # abre Garlic
garlic "C:\fotos\a.png"  # abre la rueda para ese archivo (si ya está abierto, la reutiliza)
```

Sin instalar globalmente: `node bin/garlic.js archivo.pdf`.

**Integración con el menú «Enviar a» (Windows):** pulsa `Win + R`, escribe `shell:sendto`, crea un acceso directo a `Garlic.bat` y llámalo «Garlic». Entonces *clic derecho → Enviar a → Garlic* abre la rueda para ese archivo.

### Iniciar con el sistema

En la app: **Sistema → Iniciar con el sistema**. (Windows y macOS.)

## Compatibilidad por sistema

| | Windows 10/11 | macOS | Linux |
|---|:---:|:---:|:---:|
| Rueda, conversiones, editor, tarjetas de progreso | ✅ probado | ⚠️ sin probar | ⚠️ sin probar |
| Atajo de clic sobre el archivo | ✅ Explorador y Escritorio | ⚠️ experimental (Finder, vía AppleScript) | ❌ no disponible* |
| Elegir archivo / arrastrar / `garlic archivo` | ✅ | ⚠️ | ⚠️ |
| Efecto acrílico / mica | ✅ Windows 11 | — (usa *vibrancy*) | — |
| Iniciar con el sistema | ✅ | ⚠️ | ❌ |
| Empaquetado portable | ✅ | ⚠️ experimental | ⚠️ sin probar |

\* No existe una API común para saber qué archivo hay bajo el ratón en Nautilus, Dolphin, Thunar… ni en Wayland. En Linux usa *Elegir archivo…*, arrastrar o la línea de comandos.

El autor solo ha podido probar en Windows. Las partes de macOS y Linux están escritas con cuidado pero **no verificadas**; los informes de errores y pull requests son bienvenidos. Más detalles en [docs/PLATFORMS.md](docs/PLATFORMS.md).

## Formatos

| Tipo | Entrada | Salida |
|---|---|---|
| Imágenes | JPG, PNG, WEBP, BMP, TIFF, SVG, GIF, ICO, AVIF, HEIC/HEIF | PNG, JPG, WEBP, BMP, TIFF, SVG, ICO, PDF, DOCX |
| PDF | PDF | DOCX, TXT, MD, HTML, EPUB, JPG, PNG, WEBP, BMP, TIFF |
| Word | DOCX | TXT, MD, PDF, HTML, EPUB |
| PowerPoint | PPTX | PDF, PNG, JPG, TXT, MD, DOCX, HTML |
| Markdown / HTML / RTF / TXT / EPUB | MD, HTML, RTF, TXT, EPUB | DOCX, PDF, TXT, MD, HTML, EPUB (según el origen) |
| Hojas de cálculo | XLSX, XLS, ODS, CSV, TSV | XLSX, CSV, TSV, ODS, HTML, JSON, PDF |
| Subtítulos | SRT, VTT | SRT, VTT, TXT |
| Audio | MP3, WAV, OGG, FLAC, M4A, AAC, OPUS | MP3, M4A, WAV, FLAC, OGG, OPUS, AIFF, WMA |
| Vídeo | MP4, MOV, MKV, WEBM, AVI, M4V | MP4, MKV, WEBM, AVI, MOV, WMV, GIF, MP3, M4A, JPG, PNG |
| Comprimidos | ZIP, TAR, GZ, TGZ | extraer, ZIP, TAR, TGZ |
| Carpetas / cualquier otro archivo | — | ZIP, TAR, TGZ / ZIP, GZ |

## Ajustes y personalización

La ventana principal tiene páginas para el **Atajo** (cualquier combinación de Ctrl/Shift/Alt/Win + botón), **Apariencia** (tema, material, densidad, color de acento, transparencia, desenfoque, saturación, esquinas, tamaño, colores de la rueda), **Sonido**, **Idioma** (Automático / Español / English) y **Sistema**.

Los ajustes se guardan en un JSON dentro de la carpeta de datos del usuario:

| Sistema | Ruta |
|---|---|
| Windows | `%APPDATA%\Garlic\config.json` |
| macOS | `~/Library/Application Support/Garlic/config.json` |
| Linux | `~/.config/Garlic/config.json` |

## Privacidad y seguridad

- **Todo ocurre en tu equipo.** No hay telemetría, cuentas ni peticiones de red; la interfaz carga solo archivos locales y su política CSP bloquea cualquier conexión.
- Los archivos nunca se suben a ningún sitio. Los resultados se guardan **junto al original** (y puedes moverlos desde la tarjeta).
- Las ventanas web están **aisladas** (sin Node.js, con *sandbox* y *context isolation*) y el proceso principal solo atiende a archivos que **tú has elegido**; valida rutas, ajustes y opciones de ffmpeg. Los documentos se renderizan a PDF en una ventana descartable **sin JavaScript y sin acceso a la red**.
- Garlic nunca ejecuta ni abre `.exe`, scripts o accesos directos.

Detalles, modelo de amenazas y cómo informar de una vulnerabilidad: [SECURITY.md](SECURITY.md).

## Estructura del proyecto

```text
garlic/
├─ package.json            Dependencias y scripts (npm start, test, package…)
├─ src/
│  ├─ main/                Proceso principal de Electron (Node.js)
│  │  ├─ index.js            Arranque: instancia única, bandeja, ventanas, atajo
│  │  ├─ windows.js          Ventana principal, rueda flotante y editor
│  │  ├─ hook.js             Atajo global (uiohook) y reglas de cierre de la rueda
│  │  ├─ resolvers/          «¿Qué archivo hay bajo el ratón?» — win32, darwin, (linux)
│  │  ├─ ipc.js              Todos los canales IPC, con validación
│  │  ├─ security.js         Permisos de rutas y validación de argumentos
│  │  ├─ config.js           Ajustes persistentes y su validación
│  │  ├─ jobs.js             Trabajos y tarjetas de progreso
│  │  ├─ media.js            ffmpeg (audio/vídeo) con progreso real
│  │  ├─ archive.js          Carpetas → ZIP/TAR/TGZ por streaming
│  │  ├─ render.js           HTML → PDF con Chromium (sin red ni JS)
│  │  ├─ fileactions.js      Copiar ruta, terminal, copiar/mover a…
│  │  └─ i18n.js, notify.js, dialogs.js, paths.js
│  ├─ preload/index.js     Único puente entre las páginas y el proceso principal
│  ├─ shared/              i18n.js + i18n-en.js (diccionario inglés), usados por main y renderers
│  └─ renderer/            Interfaz (HTML/CSS/JS sin framework)
│     ├─ app/               Ventana principal (ajustes)
│     ├─ wheel/             La rueda flotante
│     ├─ editor/            Editor (recortar, borrar fondo, audio/vídeo…) con zoom
│     ├─ jobs/              Tarjetas de progreso
│     └─ shared/            Motor de conversión (engine, formats, pptx), rueda SVG, tema, sonidos
├─ assets/                 Icono (SVG, PNG, ICO)
├─ bin/garlic.js           Lanzador de línea de comandos
├─ scripts/                check, package, screenshots, notices, make-icons, i18n-harvest
├─ tests/
│  ├─ unit/                Pruebas unitarias (seguridad, ajustes, idioma)
│  └─ e2e/                 Pruebas de extremo a extremo con la app real
├─ docs/                   ARCHITECTURE.md, PLATFORMS.md e imágenes
└─ .github/                CI y plantillas de issues
```

Descripción técnica completa: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Desarrollo

```bash
npm install
npm start               # ejecutar
npm run lint            # ESLint
npm run check           # sintaxis, páginas, CSP y traducciones
npm test                # pruebas unitarias
npm run test:e2e        # pruebas de extremo a extremo (abre la app de verdad, ~2 min)
npm run verify          # todo lo anterior
npm run screenshots     # regenerar docs/img
npm run notices         # regenerar THIRD_PARTY_NOTICES.md
```

**Añadir o corregir un idioma:** el español es el idioma de origen (el propio texto es la clave). Edita [`src/shared/i18n-en.js`](src/shared/i18n-en.js) o añade otro diccionario siguiendo ese formato; `npm run i18n:harvest` lista todas las cadenas visibles y `npm run test:e2e` falla si queda texto sin traducir.

Guía de contribución: [CONTRIBUTING.md](CONTRIBUTING.md).

## Solución de problemas

| Síntoma | Qué hacer |
|---|---|
| Windows bloquea el `.exe` (Control Inteligente de Aplicaciones) | Usa la carpeta portable con el `electron.exe` oficial (no empaquetes con herramientas que lo reescriban) o ejecuta desde el código con `npm start`. |
| «ffmpeg bloqueado / no se pudo iniciar» | Un antivirus o SAC bloqueó `node_modules/ffmpeg-static/ffmpeg.exe`. Permítelo o reinstala (`npm rebuild ffmpeg-static`). |
| Alt + clic no abre la rueda | Comprueba que el pill de la barra lateral dice *Atajo activo*; el archivo debe estar en una ventana del Explorador o en el Escritorio. Prueba otra combinación en *Atajo*. |
| La rueda se queda en pantalla | Se cierra con clic fuera, Esc o a los 12 s de inactividad. Si no, abre un *issue* indicando tu sistema. |
| El PDF de un `.md` no muestra una imagen | Las rutas relativas se resuelven desde la carpeta del `.md`; las imágenes remotas (`https://`) se bloquean a propósito (sin red). |
| PDF escaneado → texto vacío | No hay OCR; solo se extrae el texto seleccionable. |

## Limitaciones conocidas

- Sin OCR; los `.ppt` antiguos (binarios) no se leen, solo `.pptx`; las presentaciones se reproducen sin gráficos, SmartArt ni imágenes EMF/WMF.
- La conversión de vídeo a vídeo recodifica y puede tardar; VP9 (WEBM) es lento.
- HEIC solo de **entrada**: los navegadores no pueden crearlo.
- Los archivos muy grandes (varios GB) de imagen/documento se cargan en memoria.
- `AVIF` no se puede generar con el motor actual.

## Licencia y créditos

[MIT](LICENSE) © Sltcrd. Garlic usa software de terceros, listado en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); en particular **ffmpeg** (GPL) se descarga como dependencia separada y, si distribuyes un build que lo incluya, debes cumplir su licencia.

Inspirada en la idea de [Tangerine](https://tangerineformac.com/). Garlic es un proyecto independiente y no está afiliado a sus autores.
