# Diapasón

Calculadora visual de teoría musical para guitarra. Genera mapas de tríadas,
arpegios, escalas, modos y double stops sobre un mástil de 24 trastes. Incluye
un constructor de acordes, un glosario de construcción y un buscador por
nombre, símbolo, familia, fórmula e intervalos.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Para validar una compilación de producción:

```bash
npm run build
npm run preview
```

Para ejecutar las pruebas del dominio musical:

```bash
npm test
```

## Arquitectura

- `src/data.ts`: catálogos inmutables de notas, afinación, escalas, arpegios y acordes.
- `src/domain.ts`: cálculos puros y validación del rango de trastes.
- `src/ui.ts`: composición de la interfaz, glosario, buscador y listeners de eventos.
- `src/styles.css`: presentación aislada del comportamiento.
- `src/main.ts`: único punto de entrada.
- `tests/domain.test.ts`: pruebas de rangos, notas, double stops y CAGED.

El módulo CAGED calcula las ventanas de las formas C, A, G, E y D a partir de
la raíz seleccionada. La opción "Todas las formas" combina esas ventanas.

## Seguridad y SEO

La aplicación no recibe datos de red ni usa dependencias de runtime externas.
Evita `innerHTML`, `eval` y handlers inline; usa `textContent`, elementos
creados con APIs del DOM y tipos estrictos. El documento incluye descripción,
idioma, viewport, referrer policy y CSP. La CSP definitiva debe enviarse también
como cabecera HTTP del servidor que publique `dist/`, porque una meta CSP no
sustituye la política del servidor.

Durante `vite dev` y `vite preview` también se envían `Referrer-Policy`,
`X-Content-Type-Options: nosniff` y `Permissions-Policy`. El servidor de
producción debe conservar esas cabeceras y añadir HSTS cuando use HTTPS.
