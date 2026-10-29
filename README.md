# ¿Cómo pinta el viaje?

El clima de tu ida y vuelta al trabajo, en una pantalla pensada para el celular.

## Instalar en el celular

La web es una **PWA** con ícono propio y ventana independiente del navegador. Abrila con conexión y entrá en **Configuración → Instalar app**. Si el navegador habilita el aviso de instalación, ese botón lo abre; en caso contrario aparecen instrucciones para instalar desde su menú. En Chrome para Android también puede figurar **⋮ → Instalar y crear acceso directo → Instalar** o **Agregar a la pantalla principal → Instalar**. En iPhone: Safari → Compartir → Agregar a Inicio.

El ícono incluye un sol, una nube y un camino. Hay versiones PNG de 192 y 512 px, una máscara adaptable para Android y un ícono de 180 px para Apple. El SVG original está en `docs/assets/app-icon.svg`.

Después de una primera carga completa con conexión, se conserva la interfaz para abrirla sin Internet, junto con la última consulta que ya guarda la app en ese navegador. El nuevo pronóstico y la búsqueda de localidades necesitan conexión. Una consulta de más de una hora sigue marcada como desactualizada y no genera una recomendación favorable.

El manifiesto y el service worker usan rutas relativas para funcionar tanto en un dominio propio como en una subcarpeta de GitHub Pages. No se almacenan en el service worker páginas de acceso, credenciales ni respuestas de las APIs meteorológicas. Las cachés están separadas por la ruta de cada app. Las actualizaciones ofrecen un botón en Configuración; no reinician el formulario sin una acción del usuario.

La instalación usa HTTPS. En el alojamiento privado puede ser necesario iniciar sesión primero; en GitHub Pages el acceso será el que tenga ese sitio. Al cambiar de dominio o ruta, la instalación pertenece a la nueva dirección.

## Qué hace

- Buscador de localidades de Argentina y los 48 barrios de CABA. También reconoce **Once** (Balvanera) y **Microcentro** (San Nicolás).
- Origen, destino, horarios, vehículo y apariencia guardados en el navegador de cada persona. No necesita cuenta de ChatGPT ni de GitHub para usarlo.
- Perfiles de **moto, bicicleta y monopatín**, con criterios propios y visibles en Detalle.
- Fecha editable para hoy y los próximos seis días. Horarios editables tocando la tarjeta de ida o vuelta. Valores iniciales 06:00–07:00 y 16:00–17:00.
- Evaluación por hora en ambos extremos del viaje. La vuelta invierte origen y destino. La recomendación usa la condición más desfavorable.
- Íconos meteorológicos grandes, a color y animados; modo claro, oscuro y automático. Respeta la preferencia de reducir movimiento del dispositivo.
- En moto, la lluvia muestra **«Equipate para lluvia»**, con recomendación de botas y equipo, incluso si es intensa. En bicicleta y monopatín se mantiene **«Conviene otro transporte»** al alcanzar sus umbrales de lluvia. Tormentas, hielo, nieve y otras condiciones adversas graves mantienen su advertencia en los tres vehículos.
- Consulta al abrir y actualización cada 15 minutos mientras la página está visible. Datos de más de una hora, horarios pasados o información incompleta nunca producen una recomendación favorable.
- Si falla la red, avisa y conserva la última consulta de esa misma ruta, con su fecha y hora.

La fecha no se fija permanentemente: al abrir se elige la próxima jornada según la hora de la ida guardada. Las preferencias se conservan en ese navegador/dispositivo y no se sincronizan entre equipos.

## Publicar en GitHub Pages

El sitio está en **`docs/`**. En **Settings → Pages**, elegí:

1. Source: **Deploy from a branch**.
2. Branch: **main**.
3. Folder: **/docs**.
4. Save.

Los archivos usan rutas relativas y `.nojekyll`; no requieren compilación, servidor de aplicación, claves meteorológicas ni servicios de ChatGPT. GitHub Pages sirve el contenido público. No hay direcciones personales ni preferencias de usuarios incluidas en el repositorio.

## Desarrollo y pruebas

Con Node.js:

```sh
node --test tests/*.test.mjs
```

Para una vista local se puede servir `docs/` con cualquier servidor estático. El navegador necesita Internet para buscar localidades y consultar Open-Meteo.

Las pruebas cubren perfiles y umbrales, lectura horaria de precipitación y ráfagas, dos zonas, cambio de sentido, minutos parciales, medianoche, datos incompletos/viejos, zonas de Argentina y recomendaciones de equipo.

Las pruebas de PWA verifican manifiesto, tamaños reales de los íconos, apertura sin red, exclusión de páginas de acceso y de las APIs, aislamiento entre rutas y activación de actualizaciones. Cuando se modifiquen los archivos de la interfaz, se debe cambiar `VERSION` en `docs/sw.js` para preparar una nueva caché.

Se verificó en navegador con pronóstico real y pantallas de **360×640**, **390×780** y **430×844**, sin desplazamiento horizontal ni vertical para el resumen probado. Textos excepcionalmente largos, zoom o tamaños de letra mayores pueden aumentar la altura para mantener la legibilidad. Los editores y el detalle admiten desplazamiento.

## Datos y límites

El pronóstico se consulta en [Open-Meteo](https://open-meteo.com/en/docs); la búsqueda de localidades utiliza su [Geocoding API](https://open-meteo.com/en/docs/geocoding-api), basada en GeoNames. El uso está destinado a una herramienta personal sin fines comerciales y está sujeto a los términos y límites del proveedor.

Los datos horarios de precipitación, probabilidad y ráfagas describen la **hora anterior al timestamp**. Por ejemplo, para 06–07 se usa el registro de las 07. Temperatura y viento usan los extremos horarios de cada intervalo. Los minutos parciales se cubren con horas completas; las probabilidades no se suman. La precipitación mostrada toma el mayor acumulado de las dos zonas y no suma dos lugares distintos.

Los barrios de CABA usan puntos representativos calculados a partir de los polígonos públicos de [Buenos Aires Data](https://data.buenosaires.gob.ar/dataset/barrios), licencia CC-BY-2.5-AR. Son referencias de zona, no ubicaciones exactas de domicilios. Ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Los umbrales son criterios orientativos propios del panel, no garantías de seguridad, límites de homologación ni alertas oficiales. No se traza el recorrido ni se estima el clima calle por calle. Las [alertas del SMN](https://www.smn.gob.ar/alertas) están enlazadas desde el detalle.

Creado para Facu y sus amigos · **by Facu**.
