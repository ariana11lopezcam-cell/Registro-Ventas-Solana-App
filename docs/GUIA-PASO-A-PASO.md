# Guía paso a paso

Necesitas: cuenta de GitHub, Solflare (u otra wallet de Solana) y Solana Playground. Todo en **Devnet**.

## 1. Subir el proyecto a GitHub (fork + Codespaces)

1. Entra a https://github.com/WayLearnLatam/Registro-Ventas-Solana-App y pulsa **Fork** (debe quedar público).
2. En tu fork: **Code → Codespaces → Create codespace on main**. Espera a que termine.
3. Arrastra `proyecto-solana-cajeros.zip` al explorador de archivos del Codespace (a la raíz).
4. En la terminal:

```bash
unzip -o proyecto-solana-cajeros.zip -d /tmp/p
cp -a /tmp/p/proyecto-solana-cajeros/. .
rm proyecto-solana-cajeros.zip
npm ci
npm run cliente
```

## 2. Desplegar el programa (Solana Playground)

1. Abre https://beta.solpg.io y crea un proyecto **Anchor (Rust)** llamado `registro`.
2. Reemplaza todo `src/lib.rs` con el contenido de `programa/src/lib.rs`.
3. Conecta la wallet de Playground (abajo a la izquierda) en **devnet**.
4. Consigue SOL de prueba en https://faucet.solana.com (o `solana airdrop 2` en la terminal de Playground). El despliegue puede requerir varios SOL; revisa el costo que indica Playground.
5. **Build**. `declare_id!` se llena solo con tu Program ID.
6. **Deploy**. Copia el **Program ID**.
7. En la pestaña Build & Deploy → **IDL → Export**. Se descarga un `.json`.
8. Copia el `declare_id!(...)` resultante a `programa/src/lib.rs` de tu repositorio.

## 3. Conectar el frontend

En el Codespace crea la carpeta `tmp-idl`, arrastra el IDL como `tmp-idl/registro.json` y ejecuta:

```bash
npm run configurar:idl -- ./tmp-idl/registro.json --program-id TU_PROGRAM_ID
npm run verificar
npm run dev
```

En la pestaña **Ports** abre el puerto **5173** con *Open in Browser* (pestaña normal, donde está tu wallet).

> `npm run verificar` está pensado para ejecutarse con tu IDL ya exportado. Si una prueba falla solo por diferencias de formato del IDL, la app puede seguir funcionando: revisa el mensaje.

## 4. Preparar dos wallets

En Solflare ten dos cuentas, ambas en **Devnet** y con SOL de prueba:

- **A — Autoridad** (dueña del negocio)
- **B — Cajero**

## 5. Recorrido de prueba

Guarda el enlace de Explorer de cada operación para la tabla de evidencias del README.

| # | Wallet | Acción | Resultado esperado |
| --- | --- | --- | --- |
| 1 | A | Crear registro (usa un nombre tuyo, el mismo en todos los pasos) | Confirmada |
| 2 | A | Crear cliente "Ana" | ID 1 |
| 3 | A | Registrar venta CAF01 por 50 | Aparece en Ana |
| 4 | A | Corregir importe a 55 | Monto 55 |
| 5 | A | Devolución de CAF01 | Desaparece |
| 6 | A | Cajeros → Autorizar B, límite 100 | Permiso con 0 ventas |
| 7 | B | Vender como cajero: dirección de A, CAF02 por 60 | Confirmada |
| 8 | B | Vender CAF03 por 150 | Rechazo: supera el límite |
| 9 | A | Cambiar límite a 200 | Límite 200 |
| 10 | B | Vender CAF03 por 150 | Confirmada |
| 11 | A | Revocar B | Sin permiso |
| 12 | B | Vender CAF04 | Rechazo: no autorizada |

Los rechazos 8 y 12 los avisa primero la app, sin pedir firma. La protección real está en el programa y se comprueba en `pruebas-programa/`.

## Problemas frecuentes

| Problema | Solución |
| --- | --- |
| "Falta la instruccion autorizarcajero" | Exportaste el IDL del programa base. Despliega el `lib.rs` de este proyecto. |
| Sigue "Programa de referencia" | Falta el paso 3. Reinicia `npm run dev`. |
| La wallet no aparece | Abre la app fuera de la vista previa del editor. |
| Falta SOL | Pide SOL en Devnet para esa wallet (el cajero también lo necesita). |
