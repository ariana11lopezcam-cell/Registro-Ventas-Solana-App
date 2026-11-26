use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use registro::{accounts as ac, instruction as ix, Cajero, Cliente};
use solana_program_test::{processor, ProgramTestBanksClientExt, ProgramTest, ProgramTestContext};
use solana_sdk::{account_info::AccountInfo, entrypoint::ProgramResult, instruction::{Instruction, InstructionError}, pubkey::Pubkey, signature::{Keypair, Signer}, system_instruction, system_program, transaction::{Transaction, TransactionError}};

// Adaptador: el entry de Anchor liga las vidas del slice y de las cuentas.
fn entry<'a, 'b, 'c, 'd>(p: &'a Pubkey, a: &'b [AccountInfo<'c>], d: &'d [u8]) -> ProgramResult {
    let a: &'c [AccountInfo<'c>] = Box::leak(Box::new(a.to_vec()));
    registro::entry(p, a, d)
}
fn mk(a: impl ToAccountMetas, d: impl InstructionData) -> Instruction {
    Instruction { program_id: registro::ID, accounts: a.to_account_metas(None), data: d.data() }
}
async fn send(c: &mut ProgramTestContext, i: Instruction, s: &Keypair) -> Result<(), TransactionError> {
    let bh = c.banks_client.get_new_latest_blockhash(&c.last_blockhash).await.unwrap();
    c.last_blockhash = bh;
    let t = Transaction::new_signed_with_payer(&[i], Some(&s.pubkey()), &[s], bh);
    c.banks_client.process_transaction(t).await.map_err(|e| e.unwrap())
}
fn code(r: Result<(), TransactionError>) -> u32 {
    match r { Err(TransactionError::InstructionError(_, InstructionError::Custom(n))) => n, other => panic!("esperaba error custom: {other:?}") }
}
fn pda(s: &[&[u8]]) -> Pubkey { Pubkey::find_program_address(s, &registro::ID).0 }

#[tokio::test]
async fn flujo_completo_base_y_cajeros() {
    let mut c = ProgramTest::new("registro", registro::ID, processor!(entry)).start_with_context().await;
    let (owner, cajero, intruso) = (Keypair::new(), Keypair::new(), Keypair::new());
    for k in [&owner, &cajero, &intruso] {
        let p = c.payer.insecure_clone();
        let i = system_instruction::transfer(&p.pubkey(), &k.pubkey(), 2_000_000_000);
        send(&mut c, i, &p).await.unwrap();
    }
    let (o, j, x) = (owner.pubkey(), cajero.pubkey(), intruso.pubkey());
    let sys = system_program::ID;
    let reg = pda(&[b"registro", b"Cafe", o.as_ref()]);
    let cli = pda(&[b"cliente", reg.as_ref(), &1u16.to_le_bytes()]);
    let per = pda(&[b"cajero", reg.as_ref(), j.as_ref()]);
    let vta = |s: &str| pda(&[b"venta", cli.as_ref(), s.as_bytes()]);

    send(&mut c, mk(ac::NuevoRegistro { owner: o, registro: reg, system_program: sys }, ix::CrearRegistro { nombre_negocio: "Cafe".into() }), &owner).await.unwrap();
    send(&mut c, mk(ac::NuevoCliente { owner: o, registro: reg, cliente: cli, system_program: sys }, ix::CrearCliente { nombre: "Ana".into() }), &owner).await.unwrap();

    let venta_caj = |quien: Pubkey, permiso: Pubkey, sku: &str, monto: u32| mk(
        ac::NuevaVentaCajero { cajero: quien, registro: reg, permiso, cliente: cli, venta: vta(sku), system_program: sys },
        ix::RegistrarVentaCajero { _id_cliente: 1, sku: sku.into(), descripcion: "Moca".into(), monto });
    let autorizar = |firma: Pubkey, quien: Pubkey, limite: u32| mk(
        ac::NuevoCajero { owner: firma, registro: reg, permiso: pda(&[b"cajero", reg.as_ref(), quien.as_ref()]), system_program: sys },
        ix::AutorizarCajero { cajero: quien, limite });

    // Sin permiso: la cuenta no existe (3012 AccountNotInitialized)
    assert_eq!(code(send(&mut c, venta_caj(j, per, "CAF01", 50), &cajero).await), 3012);
    // Solo el owner autoriza (6000 NoOwner)
    assert_eq!(code(send(&mut c, autorizar(x, x, 100), &intruso).await), 6000);
    assert_eq!(code(send(&mut c, autorizar(o, j, 0), &owner).await), 6002);
    assert_eq!(code(send(&mut c, autorizar(o, o, 5), &owner).await), 6003);
    send(&mut c, autorizar(o, j, 100), &owner).await.unwrap();

    assert_eq!(code(send(&mut c, venta_caj(j, per, "CAF01", 101), &cajero).await), 6005);
    assert_eq!(code(send(&mut c, venta_caj(j, per, "CAF01", 0), &cajero).await), 6004);
    // Otra wallet usando el permiso ajeno (2006 ConstraintSeeds)
    assert_eq!(code(send(&mut c, venta_caj(x, per, "CAF01", 50), &intruso).await), 2006);
    send(&mut c, venta_caj(j, per, "CAF01", 100), &cajero).await.unwrap();

    // El cajero NO puede corregir ni devolver
    let cambiar = |f: Pubkey| mk(ac::ModificarVenta { owner: f, registro: reg, cliente: cli, venta: vta("CAF01") }, ix::CambiarMonto { _id_cliente: 1, sku: "CAF01".into(), nuevo_monto: 1 });
    let devolver = |f: Pubkey| mk(ac::EliminarVenta { owner: f, registro: reg, cliente: cli, venta: vta("CAF01") }, ix::HacerDevolucion { _id_cliente: 1, sku: "CAF01".into() });
    assert_eq!(code(send(&mut c, cambiar(j), &cajero).await), 6000);
    assert_eq!(code(send(&mut c, devolver(j), &cajero).await), 6000);

    let limite = |f: Pubkey, n: u32| mk(ac::ModificarCajero { owner: f, registro: reg, permiso: per }, ix::CambiarLimite { _cajero: j, nuevo_limite: n });
    assert_eq!(code(send(&mut c, limite(j, 999), &cajero).await), 6000);
    send(&mut c, limite(o, 200), &owner).await.unwrap();
    send(&mut c, venta_caj(j, per, "CAF02", 150), &cajero).await.unwrap();

    let a = c.banks_client.get_account(per).await.unwrap().unwrap();
    let p = Cajero::try_deserialize(&mut &a.data[..]).unwrap();
    let a = c.banks_client.get_account(cli).await.unwrap().unwrap();
    assert!(a.data.len() > 8);
    let _ = Cliente::try_deserialize(&mut &a.data[..]).unwrap();
    let mut esperado = Vec::new();
    for k in [reg, j] { esperado.extend_from_slice(k.as_ref()); }
    esperado.extend_from_slice(&200u32.to_le_bytes()); esperado.extend_from_slice(&2u32.to_le_bytes());
    let mut real = Vec::new(); anchor_lang::AnchorSerialize::serialize(&p, &mut real).unwrap();
    assert_eq!(real, esperado);

    // El owner corrige y devuelve ventas hechas por el cajero
    send(&mut c, cambiar(o), &owner).await.unwrap();
    send(&mut c, devolver(o), &owner).await.unwrap();

    // Llenar historial: hay 1 venta, caben 9 mas
    for n in 0..9 { send(&mut c, venta_caj(j, per, &format!("S{n}"), 10), &cajero).await.unwrap(); }
    assert_eq!(code(send(&mut c, venta_caj(j, per, "S9", 10), &cajero).await), 6006);

    send(&mut c, mk(ac::EliminarCajero { owner: o, registro: reg, permiso: per }, ix::RevocarCajero { cajero: j }), &owner).await.unwrap();
    assert!(c.banks_client.get_account(per).await.unwrap().is_none());
    assert_eq!(code(send(&mut c, venta_caj(j, per, "S9", 10), &cajero).await), 3012);
    send(&mut c, autorizar(o, j, 10), &owner).await.unwrap();
}
