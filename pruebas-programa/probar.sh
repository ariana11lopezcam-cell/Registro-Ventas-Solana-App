#!/usr/bin/env bash
# Prueba programa/src/lib.rs en un banco local de Solana. No usa Devnet ni wallets.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p src
# ID ficticio solo para la prueba; no modifica tu archivo original.
sed 's/declare_id!("[^"]*")/declare_id!("38oTMyvUTmqkBQeMiuok5F2mPjp9dVadWdBeQTDNmTUY")/' ../programa/src/lib.rs > src/lib.rs
RUST_LOG=error cargo test
