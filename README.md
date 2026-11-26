# Registro de Ventas con Cajeros Autorizados · Solana Devnet

Proyecto del **Solana Engineering Track: Advanced** (WayLearn). Ruta: proyecto guiado con una mejora funcional propia.

- **Participante:** TU_NOMBRE
- **Program ID (Devnet):** `TU_PROGRAM_ID`
- **Repositorio:** TU_URL_DE_GITHUB

## Qué hace

Registro de un negocio, sus clientes y sus ventas. Cada entidad vive en su propia cuenta (PDA):

| Cuenta | Semillas | Contenido |
| --- | --- | --- |
| Registro | `"registro"`, nombre, autoridad | autoridad, nombre, clientes (máx. 10), contador |
| Cliente | `"cliente"`, registro, id (u16) | id, nombre, compras, historial (máx. 10) |
| Venta | `"venta"`, cliente, SKU | SKU, descripción, monto |
| **Cajero** (mejora) | `"cajero"`, registro, wallet del cajero | registro, cajero, límite, ventas registradas |

## Mejora propia: cajeros autorizados con límite

En el programa base solo la autoridad puede registrar ventas, así que un negocio con empleados tendría que compartir su wallet. Ahora la autoridad delega **un solo permiso**, sin compartir claves.

| Instrucción | Firma | Regla |
| --- | --- | --- |
| `autorizar_cajero` | Autoridad | Crea el permiso. Límite > 0 y wallet distinta de la autoridad. |
| `cambiar_limite` | Autoridad | Actualiza el importe máximo por venta. |
| `revocar_cajero` | Autoridad | Cierra el permiso y recupera su renta. |
| `registrar_venta_cajero` | Cajero | Requiere permiso activo, `0 < monto <= límite` e historial con espacio. |

El cajero **no** puede crear clientes, corregir importes, devolver ventas ni administrar permisos.

**Alcance:** el límite es por venta, no diario (varias ventas pueden sumar más). El cajero paga la renta de cada cuenta Venta y, si la autoridad la devuelve, esa renta llega a la autoridad. El contador se reinicia si se revoca y se vuelve a autorizar.

Errores nuevos: `LimiteInvalido` (6002), `CajeroEsOwner` (6003), `MontoInvalido` (6004), `LimiteExcedido` (6005), `HistorialLleno` (6006).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `programa/src/lib.rs` | Programa Rust + Anchor (base + mejora) |
| `pruebas-programa/` | Prueba de integración del programa (local, sin Devnet) |
| `src/solana/cajeros.ts`, `src/components/Cajeros.tsx` | Frontend de la mejora |
| `src/solana/` | PDAs, lecturas, acciones y envío de transacciones |
| `idl.json`, `clients/js/` | IDL y cliente generado con Codama |
| `tests/` | Pruebas del cliente |
| `docs/` | Guía paso a paso y entrega |

## Ejecutar

1. Despliega `programa/src/lib.rs` desde Solana Playground y exporta el IDL.
2. `npm ci`
3. `npm run configurar:idl -- ./tmp-idl/registro.json --program-id TU_PROGRAM_ID`
4. `npm run dev`

Detalle en [docs/GUIA-PASO-A-PASO.md](./docs/GUIA-PASO-A-PASO.md). El `idl.json` incluido es de referencia y bloquea la escritura hasta importar el tuyo.

## Pruebas

```bash
npm run verificar                 # TypeScript, pruebas del cliente y build
bash pruebas-programa/probar.sh   # programa en Rust (requiere Rust; tarda la primera vez)
```

## Evidencias en Devnet

| Operación | Wallet que firma | Enlace en Solana Explorer |
| --- | --- | --- |
| Crear registro | Autoridad | |
| Crear cliente | Autoridad | |
| Registrar venta | Autoridad | |
| Corregir importe | Autoridad | |
| Devolución | Autoridad | |
| Autorizar cajero | Autoridad | |
| Venta por cajero | Cajero | |
| Cambiar límite | Autoridad | |
| Revocar cajero | Autoridad | |

## Créditos

Base: [Registro-Ventas-Solana-PDA](https://github.com/WayLearnLatam/Registro-Ventas-Solana-PDA) y [Registro-Ventas-Solana-App](https://github.com/WayLearnLatam/Registro-Ventas-Solana-App) de WayLearn. La mejora de cajeros se desarrolló con apoyo de IA (Claude).
