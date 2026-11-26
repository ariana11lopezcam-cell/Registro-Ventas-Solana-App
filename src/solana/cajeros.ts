// MEJORA PROPIA: cajeros autorizados con límite por venta.
import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import {
  fetchMaybeCajero, fetchMaybeCliente, getAutorizarCajeroInstruction, getCambiarLimiteInstruction,
  getRevocarCajeroInstruction, getRegistrarVentaCajeroInstruction,
} from '../../clients/js/src/generated';
import { rpc } from './conexion';
import { direccionDe } from './acciones';
import { pdaRegistro, pdaCajero, pdaCliente, pdaVenta } from './pdas';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';
import { negocioValido, skuValido, descripcionValida, idValido, montoValido, direccionValida } from './validaciones';

function firmante(wallet: WalletFirma) {
  comprobarConfiguracion();
  return createNoopSigner(direccionDe(wallet));
}

/** Lectura sin firma. Devuelve null si esa wallet no tiene permiso en el negocio. */
export async function leerPermiso(nombreNegocio: string, owner: string, cajero: string) {
  const registro = pdaRegistro(negocioValido(nombreNegocio), direccionValida(owner, 'La autoridad'));
  const permiso = pdaCajero(registro, direccionValida(cajero, 'La wallet del cajero'));
  const cuenta = await fetchMaybeCajero(rpc, permiso);
  return cuenta.exists
    ? { direccion: permiso, limite: cuenta.data.limite, ventasRegistradas: cuenta.data.ventasRegistradas }
    : null;
}

function cuentasPermiso(wallet: WalletFirma, nombreNegocio: string, cajeroTexto: string) {
  const nombre = negocioValido(nombreNegocio);
  const cajero: Address = direccionValida(cajeroTexto, 'La wallet del cajero');
  const owner = firmante(wallet);
  const registro = pdaRegistro(nombre, owner.address);
  return { owner, registro, cajero, permiso: pdaCajero(registro, cajero) };
}

export async function autorizarCajero(wallet: WalletFirma, connection: Connection, nombreNegocio: string, cajeroTexto: string, limite: number, opciones?: OpcionesEnvio) {
  limite = montoValido(limite);
  const cuentas = cuentasPermiso(wallet, nombreNegocio, cajeroTexto);
  if (cuentas.cajero === cuentas.owner.address) throw new Error('La autoridad no necesita autorizarse como cajero. Usa otra wallet.');
  return enviar(getAutorizarCajeroInstruction({ ...cuentas, limite }), wallet, connection, opciones);
}

export async function cambiarLimite(wallet: WalletFirma, connection: Connection, nombreNegocio: string, cajeroTexto: string, nuevoLimite: number, opciones?: OpcionesEnvio) {
  nuevoLimite = montoValido(nuevoLimite);
  const cuentas = cuentasPermiso(wallet, nombreNegocio, cajeroTexto);
  return enviar(getCambiarLimiteInstruction({ ...cuentas, nuevoLimite }), wallet, connection, opciones);
}

export async function revocarCajero(wallet: WalletFirma, connection: Connection, nombreNegocio: string, cajeroTexto: string, opciones?: OpcionesEnvio) {
  const cuentas = cuentasPermiso(wallet, nombreNegocio, cajeroTexto);
  return enviar(getRevocarCajeroInstruction(cuentas), wallet, connection, opciones);
}

/** La wallet conectada es el cajero: firma y paga la renta de la venta. */
export async function registrarVentaCajero(wallet: WalletFirma, connection: Connection, nombreNegocio: string, autoridad: string, idCliente: number, sku: string, descripcion: string, monto: number, opciones?: OpcionesEnvio) {
  nombreNegocio = negocioValido(nombreNegocio);
  idCliente = idValido(idCliente);
  sku = skuValido(sku);
  descripcion = descripcionValida(descripcion);
  monto = montoValido(monto);
  const owner = direccionValida(autoridad, 'La autoridad');
  const cajero = firmante(wallet);
  const registro = pdaRegistro(nombreNegocio, owner);
  const permiso = pdaCajero(registro, address(cajero.address));
  const cliente = pdaCliente(registro, idCliente);
  const venta = pdaVenta(cliente, sku);

  // Avisos tempranos para el usuario. Quien de verdad protege es el programa.
  const [datosPermiso, datosCliente] = await Promise.all([fetchMaybeCajero(rpc, permiso), fetchMaybeCliente(rpc, cliente)]);
  if (!datosPermiso.exists) throw new Error('Tu wallet no está autorizada como cajero de este negocio.');
  if (monto > datosPermiso.data.limite) throw new Error('El monto supera tu límite autorizado de ' + datosPermiso.data.limite + '.');
  if (!datosCliente.exists) throw new Error('Ese cliente no existe en el negocio.');
  if (datosCliente.data.historial.length >= 10) throw new Error('El cliente ya tiene 10 ventas activas.');

  const ix = getRegistrarVentaCajeroInstruction({ cajero, registro, permiso, cliente, venta, idCliente, sku, descripcion, monto });
  return enviar(ix, wallet, connection, opciones);
}
