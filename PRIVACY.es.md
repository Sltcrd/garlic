# Política de privacidad

*Última actualización: 2026-10-22 · [English](PRIVACY.md)*

Garlic es una aplicación de escritorio gratuita y de código abierto para Windows (macOS y Linux son experimentales) que convierte y edita archivos en tu equipo. Esta política explica qué datos maneja Garlic. En resumen: **Garlic funciona en tu equipo, no tiene cuentas y no envía telemetría. Tus archivos nunca se suben a ningún sitio.**

## Lo que Garlic *no* hace

- **No** recoge, guarda ni transmite datos personales, estadísticas de uso, informes de errores ni analíticas.
- **No** requiere cuenta ni inicio de sesión.
- **No** sube tus archivos, nombres, rutas ni contenido a ningún servidor.
- **No** muestra publicidad ni comparte nada con terceros.

## Datos que se quedan en tu equipo

| Dato | Dónde | Para qué |
|---|---|---|
| **Ajustes** (tema, colores, idioma, combinación del atajo, opciones de sonido y de actualizaciones) | `config.json` en la carpeta de datos del usuario (`%APPDATA%\Garlic` en Windows) | Recordar tus preferencias. No contiene datos personales y nunca sale de tu equipo. |
| **Tus archivos y los resultados de las conversiones** | Junto al archivo original, o en una carpeta que elijas | Garlic solo lee archivos y carpetas que **tú** eliges (diálogo de archivos, arrastrar y soltar, el atajo con clic o la línea de comandos) y guarda los resultados en su carpeta. |
| **Archivos temporales** | La carpeta temporal del sistema | Se crea un HTML temporal mientras un documento se convierte en PDF y se borra justo después. |
| **Accesos directos de Windows / entrada de inicio** | Menú Inicio, escritorio o la clave «Run» del registro | Solo si pulsas los botones o el interruptor de *Sistema*. Puedes quitarlos cuando quieras. |

## Cómo funciona el atajo con clic (supervisión de entrada)

Para abrir la rueda cuando mantienes una combinación de teclas (por defecto **Alt + clic izquierdo**), Garlic escucha los clics globales del ratón y las teclas modificadoras del teclado mientras está en ejecución. Esto se procesa **solo de forma local y en memoria**, para detectar la combinación y para cerrar la rueda al pulsar una tecla; Garlic **no** registra, guarda ni transmite lo que escribes ni dónde haces clic. Cuando se detecta la combinación, Garlic pregunta al sistema operativo qué archivo hay bajo el cursor (una consulta local al Explorador de Windows) y abre la rueda para él. Puedes desactivar el atajo en la app cuando quieras.

## La única petición de red: la búsqueda de actualizaciones

Garlic puede comprobar si existe una versión nueva. Es la **única conexión de red que hace**:

- Envía una petición HTTPS a la API pública de GitHub (`api.github.com/repos/Sltcrd/garlic/releases/latest`) al arrancar y cada pocas horas.
- La petición **no contiene datos personales ni ningún identificador**: solo lo que lleva cualquier petición HTTPS (tu dirección IP, tal como la ve GitHub) y un agente de usuario `Garlic/<versión>`.
- Lee el número de la última versión, sus notas y la dirección de su página. No se descarga ni se instala nada automáticamente; el botón solo abre la página de la release en tu navegador.
- **Puedes desactivarla** en *Sistema → Buscar actualizaciones*. Con ella apagada, Garlic no hace ninguna petición de red.

GitHub procesa esa petición según [su propia política de privacidad](https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement). Hasta donde sabe el autor, Garlic no hace ninguna otra conexión de red; el código fuente es público para que cualquiera lo verifique, y las pantallas de la interfaz están limitadas por una Content Security Policy que bloquea todo acceso a la red.

## Sitio web y descargas

- El sitio del proyecto (<https://sltcrd.github.io/garlic/>) está alojado en GitHub Pages. No tiene analíticas ni cookies; solo guarda tu elección de idioma (ES/EN) en el almacenamiento local de tu navegador. GitHub puede registrar las visitas según su política de privacidad.
- Las versiones se descargan desde GitHub. Cada una incluye un archivo con su suma SHA-256 para que verifiques la descarga.

## Componentes de terceros

Garlic incluye componentes de código abierto (Electron/Chromium, ffmpeg, pdf.js y otros, listados en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Se ejecutan localmente dentro de la aplicación. Garlic no activa telemetría ni informes de errores en ninguno de ellos.

## Menores

Garlic no recoge datos personales de nadie, tampoco de menores.

## Tus derechos y el borrado de datos

Como Garlic no recoge datos personales, no hay nada que solicitar ni borrar en un servidor. Para eliminar todo lo que Garlic guarda localmente, borra su carpeta, la carpeta de ajustes `%APPDATA%\Garlic` y los accesos directos o entradas de inicio que hayas creado.

## Cambios en esta política

Los cambios se publican en este archivo del repositorio público, y su historial es visible en Git. La fecha de arriba indica la última actualización.

## Contacto

Para dudas o preocupaciones de privacidad, abre un issue o una discusión en <https://github.com/Sltcrd/garlic>. Para informar de un problema de seguridad de forma privada, usa el formulario *Report a vulnerability* descrito en [SECURITY.md](SECURITY.md).
