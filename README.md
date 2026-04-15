# Coldroom Inventory (Offline + Scanner Bluetooth HID)

PWA Offline-First para cámara de frío:

## Instalación
Requisitos: Node 18+

```bash
npm install
npm run dev
```

Abrir:
- http://localhost:5173

## Instalar como app (PWA)
En Chrome Android:
- abre la URL
- menú ⋮ → “Agregar a pantalla principal”

## Operación con scanner
- Empareja el scanner por Bluetooth (modo HID/teclado).
- Recomendado: sufijo ENTER al final del scan.
- El hook `useScanQueue` evita doble-scan y procesa scans en cola (si escanean rápido).

## Export Excel
Pantalla “Exportar” → genera .xlsx para respaldo manual.


## Entrada + Ubicación (manual)
En la pantalla **Entrada**, ahora puedes seleccionar **Piso + Lado** y tocar la **posición exacta** (A..L / 1..7). Al guardar, se registra el pallet y se ocupa esa ubicación (con validación anti-ocupado).

## Login / Roles (v8)
El sistema ahora incluye **registro de usuarios**, **login** y **roles** (control de acceso) guardados en IndexedDB (offline).

### Usuario Admin inicial
En el primer uso se crea automáticamente:
- Usuario: **admin**
- Contraseña: **admin123**

Recomendación: entra como admin y cambia la contraseña (Perfil) y/o crea usuarios operativos.

### Roles disponibles
- **Admin**: acceso total + panel de usuarios
- **Calidad (Proceso)**: acceso a /quality (modo Proceso)
- **Calidad (Despacho)**: acceso a /quality (modo Despacho)
- **Despacho**: acceso a /dispatch
- **Cámara / Almacén**: acceso a /camera + /entry + /assign-fifo + /exit
- **Lectura**: acceso a reportes (resumen/buscar/export)

### Importante (offline)
Los usuarios/roles se guardan **solo en el dispositivo** donde se usa la app. Para multi-dispositivo o multi-planta, lo profesional es conectar a un backend.
