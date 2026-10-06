# ADR 0001: Key Derivation Function (KDF)

- Status: Accepted
- Date: 2026-10-06

## Context

Fidus encrypts the vault on the client, so the encryption key must be derived
from the user's master password. A human-chosen password has far less entropy
than a cryptographic key, and a key derivation function (KDF) does not add
entropy: it turns the password and a random salt into key material of the
exact size the cipher requires, and makes each guess expensive to compute.

The adversary this decision addresses is an attacker who obtains a copy of the
encrypted vault (for example, from a compromised server, a leaked backup, or a
stolen device) and attacks the master password offline. Offline, there is no
rate limiting, no lockout and no detection, so the only brake on guessing is
the cost of each attempt. That cost must be high enough to make guessing
impractical for a reasonably strong password, yet low enough that unlocking
the vault remains acceptable on the user's slowest supported device.

Fast hashes and compute-bound KDFs let an attacker run many guesses in
parallel on GPUs or ASICs. A memory-hard KDF forces each guess to use a large
amount of memory, which reduces that hardware advantage.

## Options considered

1. **PBKDF2-HMAC-SHA256 (native Web Crypto API).**
   Pros: no external dependency, simple to audit, available in every browser.
   Cons: compute-bound only, so GPUs and ASICs attack it far more efficiently
   than a memory-hard function.

2. **Argon2id via WebAssembly.**
   Pros: memory-hard, the primary recommendation of the OWASP Password Storage
   Cheat Sheet and specified in RFC 9106; resists GPU/ASIC parallelism better.
   Cons: not part of the Web Crypto API, so it requires a third-party library
   and a WASM artifact (supply-chain risk), a CSP exception, and more build
   and testing effort.

3. **PBKDF2 first, migrate to Argon2id later.**
   Pros: faster initial progress while keeping an upgrade path.
   Cons: ships a weaker KDF in the meantime, and the migration may be
   postponed indefinitely; every vault created before it needs re-derivation.

## Decision

Use Argon2id, running in WebAssembly inside a Web Worker. We accept the
dependency cost in exchange for resistance to offline attacks on specialized
hardware, which is the central threat to a zero-knowledge vault.

The vault format will carry a versioned `kdf` field with its parameters, so
the algorithm or its cost can be changed later without breaking existing
vaults.

## Consequences

### Positive
- Stronger resistance to GPU/ASIC guessing than PBKDF2.
- Aligned with OWASP and RFC 9106 guidance.
- A versioned `kdf` field provides cryptographic agility.

### Negative and risks
- **Supply chain:** the master password passes through third-party code.
- **CSP:** running WASM requires `'wasm-unsafe-eval'` in `script-src`, a
  deliberate relaxation that must be documented in the threat model.
- **Memory hygiene:** key material and the password may remain in WASM linear
  memory and the JS heap; zeroing buffers reduces but does not eliminate
  exposure.
- **Latency:** derivation is deliberately slow and can be heavy on low-end
  devices, so it must run off the main thread.
- **Weak master passwords:** no KDF protects a password that appears in common
  password lists; the KDF only raises the cost of each guess.

### Mitigations planned
- Pin the exact library version, commit the lockfile, vendor the reviewed WASM
  artifact and verify its integrity; never load it from a CDN at runtime.
- Validate the implementation against the official RFC 9106 test vectors.
- Run derivation in a Web Worker and benchmark on the slowest target device.
- Guide users toward long passphrases and check master passwords against known
  weak or breached lists without sending them off the device.

## Related decisions
- ADR 0002 (pending): choice of Argon2id library and parameters (memory,
  iterations, parallelism), based on benchmarks and current OWASP/RFC 9106
  guidance.
- ADR 0003 (pending): key hierarchy and authentication secret derivation.