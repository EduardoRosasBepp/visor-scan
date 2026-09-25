# Publicar Visor Scan para usarlo en el celular

La camara del telefono solo funciona en paginas con **https**. GitHub Pages lo da gratis.
No subas `test.mp4` (es solo para pruebas; `.gitignore` ya lo excluye).

## Opcion A: desde el navegador (sin comandos)

1. Entra a https://github.com/new
2. Nombre del repositorio: `visor-scan`. Marca **Public**. Crea el repositorio.
3. En el repositorio nuevo: **Add file > Upload files**.
4. Arrastra el contenido de esta carpeta `mobile/`:
   `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`
   y la carpeta `models/` completa. Luego **Commit changes**.
5. Ve a **Settings > Pages**. En *Branch* elige `main` y carpeta `/ (root)`. **Save**.
6. Espera 1 o 2 minutos. La direccion queda asi:
   `https://TU-USUARIO.github.io/visor-scan/`

## Opcion B: con la terminal (gh ya esta instalado y con sesion)

```
cd "C:\Users\jesus.gonzalez\Desktop\virtual drag n drop\mobile"
git init -b main
git add .
git commit -m "Visor Scan"
gh repo create visor-scan --public --source . --push
gh api -X POST repos/{owner}/visor-scan/pages -f "source[branch]=main" -f "source[path]=/"
```

## En el celular

1. Abre la direccion en Chrome (Android) o Safari (iPhone) **con internet**.
2. Toca **Abrir camara** y acepta el permiso.
3. Espera a que cargue el modelo la primera vez. Desde ahi queda guardado y funciona sin senal.
4. Para tenerla como app: menu del navegador > **Agregar a pantalla de inicio**.
5. Boton rojo = grabar. Al detener, **Guardar / compartir** > *Guardar video* la manda a tu galeria.
6. Engrane = ajustes: modelo Rapido o Preciso, rastro, red, contador, manos, confianza y audio.
