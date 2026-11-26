import '../src/polyfills';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { address, createNoopSigner } from '@solana/kit';
import { getAutorizarCajeroInstruction, getCambiarLimiteInstruction, getRevocarCajeroInstruction, getRegistrarVentaCajeroInstruction, REGISTRO_PROGRAM_ADDRESS } from '../clients/js/src/generated';
import { pdaRegistro, pdaCliente, pdaVenta, pdaCajero } from '../src/solana/pdas';
import { aWeb3, traducir, type InstruccionKit } from '../src/solana/tx';
import { direccionValida } from '../src/solana/validaciones';

const owner = address(new PublicKey(new Uint8Array(32).fill(7)).toBase58());
const cajero = address(new PublicKey(new Uint8Array(32).fill(8)).toBase58());
const registro = pdaRegistro('Cafe', owner);
const permiso = pdaCajero(registro, cajero);
const cliente = pdaCliente(registro, 1);
const venta = pdaVenta(cliente, 'CAF01');

function revisar(ix: InstruccionKit, nombre: string, roles: boolean[][]) {
  const convertida = aWeb3(ix);
  assert.deepEqual(convertida.data.subarray(0, 8), createHash('sha256').update('global:' + nombre).digest().subarray(0, 8));
  assert.deepEqual(convertida.keys.map((k) => [k.isSigner, k.isWritable]), roles);
}

test('la PDA del permiso usa cajero + registro + wallet', () => {
  const [esperada] = PublicKey.findProgramAddressSync([Buffer.from('cajero'), new PublicKey(registro).toBuffer(), new PublicKey(cajero).toBuffer()], new PublicKey(REGISTRO_PROGRAM_ADDRESS));
  assert.equal(permiso, esperada.toBase58());
});

test('las instrucciones de cajeros coinciden con los contextos de Rust', () => {
  const o = createNoopSigner(owner);
  revisar(getAutorizarCajeroInstruction({ owner: o, registro, permiso, cajero, limite: 100 }), 'autorizar_cajero', [[true, true], [false, false], [false, true], [false, false]]);
  revisar(getCambiarLimiteInstruction({ owner: o, registro, permiso, cajero, nuevoLimite: 200 }), 'cambiar_limite', [[true, false], [false, false], [false, true]]);
  revisar(getRevocarCajeroInstruction({ owner: o, registro, permiso, cajero }), 'revocar_cajero', [[true, true], [false, false], [false, true]]);
  revisar(getRegistrarVentaCajeroInstruction({ cajero: createNoopSigner(cajero), registro, permiso, cliente, venta, idCliente: 1, sku: 'CAF01', descripcion: 'Moca', monto: 60 }), 'registrar_venta_cajero', [[true, true], [false, false], [false, true], [false, true], [false, true], [false, false]]);
});

test('direcciones y errores nuevos se explican', () => {
  assert.throws(() => direccionValida('hola', 'La wallet'), /no es una dirección válida/);
  assert.match(traducir(new Error('custom program error: 0x1775')), /LimiteExcedido/);
});
