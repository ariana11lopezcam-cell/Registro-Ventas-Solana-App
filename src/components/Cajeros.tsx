// MEJORA PROPIA: pantalla de cajeros autorizados.
import { useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { NEGOCIO_INICIAL, UNIDAD_MONTO } from '../config/interfaz';
import { autorizarCajero, cambiarLimite, revocarCajero, registrarVentaCajero, leerPermiso } from '../solana/cajeros';
import { ErrorTransaccion, ErrorConfirmacionPendiente, enlaceTransaccion, traducir, type OpcionesEnvio } from '../solana/tx';

type Operacion = 'autorizar' | 'limite' | 'revocar' | 'venta';
const operaciones: { id: Operacion; texto: string }[] = [
  { id: 'autorizar', texto: 'Autorizar cajero' }, { id: 'limite', texto: 'Cambiar límite' },
  { id: 'revocar', texto: 'Revocar cajero' }, { id: 'venta', texto: 'Vender como cajero' },
];
type Permiso = Awaited<ReturnType<typeof leerPermiso>>;

export function Cajeros({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (valor: boolean) => void }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletDireccion = wallet.publicKey?.toBase58() ?? '';
  const [op, setOp] = useState<Operacion>('autorizar');
  const [negocio, setNegocio] = useState(NEGOCIO_INICIAL);
  const [autoridad, setAutoridad] = useState('');
  const [cajero, setCajero] = useState('');
  const [limite, setLimite] = useState('100');
  const [idCliente, setIdCliente] = useState('1');
  const [sku, setSku] = useState('CAF02');
  const [descripcion, setDescripcion] = useState('Cafe moca');
  const [monto, setMonto] = useState('60');
  const [permiso, setPermiso] = useState<Permiso | undefined>(undefined);
  const [leyendo, setLeyendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaFallida, setFirmaFallida] = useState('');
  const [error, setError] = useState('');
  const turno = useRef(0);

  const vendiendo = op === 'venta';
  // En una venta el cajero es la wallet conectada; al administrar, la autoridad lo es.
  const owner = vendiendo ? autoridad : walletDireccion;
  const wCajero = vendiendo ? walletDireccion : cajero;

  // Si cambia cualquier dato de la consulta, el resultado anterior deja de valer.
  useEffect(() => { turno.current += 1; setPermiso(undefined); setLeyendo(false); }, [negocio, owner, wCajero]);
  useEffect(() => { setFirma(''); setFirmaFallida(''); setError(''); setFase(''); }, [op, walletDireccion]);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);

  async function consultar() {
    const actual = ++turno.current;
    setLeyendo(true); setError('');
    try {
      const datos = await leerPermiso(negocio, owner, wCajero);
      if (actual === turno.current) setPermiso(datos);
    } catch (e) {
      if (actual === turno.current) setError(traducir(e));
    } finally { if (actual === turno.current) setLeyendo(false); }
  }

  async function ejecutar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true); setFase('Preparando operación…'); setFirma(''); setFirmaFallida(''); setError('');
    const opciones: OpcionesEnvio = { onEstado: (estado) => setFase(estado === 'firma' ? 'Revisa la solicitud en tu wallet…' : 'Esperando confirmación de la red…') };
    try {
      let resultado: string;
      switch (op) {
        case 'autorizar': resultado = await autorizarCajero(wallet, connection, negocio, cajero, Number(limite), opciones); break;
        case 'limite': resultado = await cambiarLimite(wallet, connection, negocio, cajero, Number(limite), opciones); break;
        case 'revocar': resultado = await revocarCajero(wallet, connection, negocio, cajero, opciones); break;
        case 'venta': resultado = await registrarVentaCajero(wallet, connection, negocio, autoridad, Number(idCliente), sku, descripcion, Number(monto), opciones); break;
      }
      setFirma(resultado); setFase(''); onCambio();
      await consultar();
    } catch (e) {
      setFase(''); setError(traducir(e));
      if (e instanceof ErrorTransaccion || e instanceof ErrorConfirmacionPendiente) setFirmaFallida(e.firma);
    } finally { setOcupado(false); }
  }

  const boton = operaciones.find((item) => item.id === op)!.texto;
  return <>
    <div className="section-heading"><div><p className="eyebrow">PERMISOS · CAJEROS · LÍMITES</p><h2>Cajeros autorizados</h2></div><span className="tag">Mejora propia</span></div>
    {programa.esReferencia && <aside className="notice information"><strong>Configura tu programa para comenzar.</strong><p>Importa el IDL exportado de tu despliegue (incluye las instrucciones de cajeros).</p></aside>}
    <div className="two-columns">
      <section className="panel operations-panel"><div className="panel-heading"><h3>Operaciones</h3><span className="small-note">Con firma</span></div>
        <div className="operation-tabs">{operaciones.map((item) => <button key={item.id} type="button" className={op === item.id ? 'active' : ''} disabled={ocupado} onClick={() => setOp(item.id)}>{item.texto}</button>)}</div>
        <form onSubmit={ejecutar}>
          <fieldset disabled={ocupado || programa.esReferencia || !wallet.publicKey}>
            <p className="help">{vendiendo ? 'La wallet conectada firma como cajero y paga la creación de la cuenta Venta.' : 'La wallet conectada firma como autoridad (dueña) del negocio.'}</p>
            <label>Nombre exacto del negocio<input value={negocio} onChange={(e) => setNegocio(e.target.value)} required /></label>
            {vendiendo
              ? <label>Dirección de la autoridad del negocio<input value={autoridad} onChange={(e) => setAutoridad(e.target.value)} spellCheck={false} autoComplete="off" required /></label>
              : <label>Wallet del cajero<input value={cajero} onChange={(e) => setCajero(e.target.value)} spellCheck={false} autoComplete="off" required /></label>}
            {(op === 'autorizar' || op === 'limite') && <label>Límite por venta<input type="number" min="1" max="4294967295" step="1" value={limite} onChange={(e) => setLimite(e.target.value)} required /><span className="help">Importe máximo ({UNIDAD_MONTO}) que el cajero puede registrar en cada venta.</span></label>}
            {vendiendo && <>
              <div className="two-fields"><label>ID del cliente<input type="number" min="1" max="65535" step="1" value={idCliente} onChange={(e) => setIdCliente(e.target.value)} required /></label><label>SKU<input value={sku} onChange={(e) => setSku(e.target.value)} required /></label></div>
              <label>Descripción<input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required /></label>
              <label>Importe<input type="number" min="1" max="4294967295" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} required /></label>
            </>}
            {op === 'revocar' && <p className="notice subtle">Cierra la cuenta del permiso. Las ventas ya registradas se conservan.</p>}
            <button className="button primary" type="submit">{ocupado ? 'Operación en curso…' : boton}</button>
          </fieldset>
        </form>
        {!wallet.publicKey && <p className="help">Conecta tu wallet de práctica para realizar operaciones.</p>}
        {ocupado && <p className="notice information" role="status">{fase}</p>}
        {firma && <p className="notice success" role="status"><strong>Operación confirmada.</strong><br /><a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">Ver transacción en Explorer</a></p>}
        {error && <p className="notice error" role="alert">{error}{firmaFallida && <><br /><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transacción en Explorer</a></>}</p>}
      </section>
      <section className="panel"><div className="panel-heading"><h3>Estado del permiso</h3><span className="small-note">Lectura sin firma</span></div>
        <p className="help">{vendiendo ? 'Consulta el permiso de tu wallet en el negocio indicado.' : 'Consulta el permiso de la wallet escrita, en tu negocio.'}</p>
        <button type="button" className="button secondary" disabled={leyendo || ocupado || programa.esReferencia || !negocio.trim() || !owner.trim() || !wCajero.trim()} onClick={() => void consultar()}>{leyendo ? 'Consultando…' : 'Consultar permiso'}</button>
        {permiso === null && <p className="notice subtle">Esa wallet no tiene un permiso activo en este negocio.</p>}
        {permiso && <>
          <div className="registry-summary"><div><span className="label">Límite por venta</span><strong>{permiso.limite.toLocaleString('es-MX')}</strong></div><div><span className="label">Ventas registradas</span><strong>{permiso.ventasRegistradas}</strong></div></div>
          <p className="label">Dirección del permiso (PDA)</p><code className="address">{permiso.direccion}</code>
        </>}
        {wallet.publicKey && <><p className="label">Tu wallet</p><code className="address">{walletDireccion}</code></>}
      </section>
    </div>
  </>;
}
