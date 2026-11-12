# CI y publicación en npm

El proyecto se distribuye como componente React con licencia MIT. Las licencias del código incluido de terceros se conservan en `THIRD_PARTY_LICENSES.txt`, regenerado al construir la biblioteca.

## Comprobaciones automáticas

`.github/workflows/ci.yml` ejecuta tests, construcción de demo y biblioteca y comprobación de tipos del consumidor en Node 22 y 24. También prueba el componente en Chromium con React 18 y 19. GitHub conserva el paquete y los resultados del navegador como artefactos de cada ejecución.

Para repetir las comprobaciones localmente:

```sh
npm ci
npm test
npm run build
npm run test:consumer-types
npm run test:component
npm pack --ignore-scripts --pack-destination artifacts
```

La prueba del navegador necesita Playwright y Chromium. En CI se instalan automáticamente; fuera del entorno de desarrollo integrado puedes instalarlo con `npm install --no-save --package-lock=false playwright@1` y `npx playwright install chromium`.

## Preparación inicial de npm

1. Sube este repositorio a GitHub y habilita Actions. Todavía no hay un remoto configurado en esta copia local.
2. Comprueba que tienes permiso para publicar el nombre de `package.json`. Si necesitas otro nombre o un scope, cámbialo antes de publicar y actualiza el lockfile y los ejemplos que importan el paquete.
3. Crea el entorno `npm` en GitHub Settings → Environments.
4. Configura el paquete en npm con un **trusted publisher** de GitHub Actions: organización/usuario, repositorio, workflow `publish.yml` y entorno `npm`. Deben coincidir exactamente.

El trusted publisher se configura sobre un paquete existente. Para la primera publicación puedes publicar desde tu equipo después de `npm login`, o configurar temporalmente el secreto de entorno `NPM_TOKEN` con un token de npm con permiso de publicación. Después configura OIDC y elimina ese secreto. No añadas tokens al repositorio.

El workflow usa Node 24, npm 11 y `id-token: write` para autenticación OIDC. Añade automáticamente la URL del repositorio de GitHub al manifiesto del paquete antes de empaquetarlo. Para repositorios y paquetes públicos npm puede generar la procedencia automáticamente con trusted publishing. Consulta los requisitos en la [documentación oficial de npm](https://docs.npmjs.com/trusted-publishers/).

## Publicar una versión

1. Actualiza `version` en `package.json` y `package-lock.json`, por ejemplo con `npm version patch --no-git-tag-version`.
2. Commitea y sube los cambios.
3. Crea una release de GitHub con un tag que coincida exactamente: para `1.0.0`, `v1.0.0`.
4. Publica la release. El workflow verifica versión y licencia, ejecuta las comprobaciones, construye y conserva el `.tgz` y publica ese archivo en npm.

También puedes ejecutar **Publish npm package** manualmente desde Actions indicando un tag existente. Un tag distinto de la versión del manifiesto falla antes de publicar. Las versiones estables usan `latest`; las versiones como `1.1.0-beta.1` usan `next`. npm no permite sobrescribir una versión publicada: utiliza otra versión para una nueva publicación.

Este trabajo solo prepara los workflows. No se ha publicado ningún paquete ni ejecutado ningún push. Las ejecuciones de GitHub y la autenticación npm deben validarse al conectar el repositorio y configurar la cuenta.
