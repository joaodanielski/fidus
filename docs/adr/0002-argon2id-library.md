# ADR 0002: Argon2id implementation

- Status: Accepted
- Date: 2026-10-06

## Context

ADR 0001 chose Argon2id running in WebAssembly but left the library and the
parameters pending. Argon2id is not part of the Web Crypto API, so the master
password will pass through third-party code. The library is therefore a
supply-chain decision as much as a functional one.

Candidates were compared on 2026-10-06 using public package metadata and
documentation. No independent audit of the Argon2 code was found for the
smaller WASM libraries.

## Options considered

1. **hash-wasm.** WASM modules bundled as base64, small and fast, no
   dependencies, MIT. Cons: the embedded binary is hard to review on its own;
   last modified in November 2024; no audit found.

2. **argon2id (OpenPGP.js project).** Very small, no dependencies, MIT,
   memory is cleared after each call, rebuildable from source. Cons: last
   modified in August 2023; no audit found; memory is not deallocated.

3. **libsodium-wrappers-sumo.** libsodium compiled to WebAssembly, maintained
   by the libsodium author, ISC, one dependency (`libsodium-sumo`), actively
   released (April 2026). Cons: larger than needed because it ships unused
   functionality; the Argon2 interface is libsodium's own.

4. **@noble/hashes (pure JavaScript).** No dependencies and no WASM, so no
   `'wasm-unsafe-eval'` in the CSP. Cons: its Argon2 module is outside the
   scope of its independent audit; slower, which pressures users toward weaker
   parameters; would contradict ADR 0001.

## Decision

Use `libsodium-wrappers-sumo` and call only its password hashing function
(`crypto_pwhash` with the Argon2id algorithm).

- Pin the exact version and commit the lockfile.
- Verify package signatures and provenance with `npm audit signatures`.
- Derivation runs in a Web Worker, as decided in ADR 0001.
- Use libsodium's own buffer-wiping function on key material when it is no
  longer needed.

## Consequences

### Positive
- libsodium is one of the most scrutinized cryptographic libraries and is
  maintained by its author.
- Single dependency chain (`libsodium-sumo`) and a recent release cadence.
- Provides a memory-wiping function for buffers.

### Negative and risks
- **Size:** the sumo build is larger than necessary; the bundle size must be
  measured and accepted.
- **Fixed parallelism:** libsodium fixes the parallelism parameter at 1 (to be
  confirmed against its documentation), so only memory and iterations are
  tunable. This fits single-threaded browsers.
- **Test vectors:** the RFC 9106 vectors use parallelism and secret inputs
  that this API does not expose, so they cannot be reproduced directly. This
  adjusts the validation promised in ADR 0001 and ADR 0003.
- **WASM exposure:** the CSP exception `'wasm-unsafe-eval'` and WASM memory
  residue risks from ADR 0001 remain.
- **Wrapper layer:** an extra JavaScript layer sits between our code and the C
  library.

### Mitigations planned
- Validate outputs against an independent Argon2id implementation using the
  same parameters (parallelism 1, no secret), plus libsodium's own known
  answers.
- Check how the WASM binary is shipped (inline or separate file) and, if
  separate, vendor and verify it.
- Re-evaluate the dependency when the lockfile changes, never upgrade
  automatically.

## Related decisions
- Refines ADR 0001, which left the library and parameters pending.
- A later ADR will set the Argon2id parameters (memory and iterations) from
  benchmark results on our slowest target device.