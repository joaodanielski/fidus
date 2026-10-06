# ADR 0004: Symmetric cipher and IV strategy

- Status: Accepted
- Date: 2026-10-06

## Context

Vault items and the wrapped Vault Key (ADR 0003) must be encrypted with an
authenticated cipher, so that both confidentiality and integrity are
protected. The choice must work without server cooperation and with several
devices editing the same vault, possibly offline.

With AES-GCM, reusing an IV under the same key is catastrophic: it leaks the
XOR of the plaintexts and allows recovery of the authentication subkey,
enabling forgery. The IV strategy is therefore as important as the algorithm.

## Options considered

1. **AES-256-GCM with a random 96-bit IV per operation.**
   Pros: native in the Web Crypto API (no new dependency), NIST SP 800-38D,
   stateless, safe across devices. Cons: random IV collision is improbable but
   not impossible; NIST limits a key to 2^32 encryptions with random IVs.

2. **AES-256-GCM with a counter-based IV.**
   Pros: no random collision. Cons: needs persistent state shared between
   devices; two offline devices can reuse the same counter value, causing the
   exact failure we want to avoid.

3. **XChaCha20-Poly1305 (libsodium, WASM).**
   Pros: 192-bit nonce makes random collision negligible. Cons: not in Web
   Crypto, so it adds a second WASM dependency to the supply-chain surface.

Rejected up front: AES-CBC with HMAC (easy to assemble incorrectly) and
AES-GCM-SIV (not native, same dependency cost as option 3).

## Decision

Use AES-256-GCM through the Web Crypto API.

- Each encryption generates a fresh 96-bit IV with `crypto.getRandomValues`.
  The IV is stored alongside the ciphertext and is never reused or derived
  from data.
- The authentication tag is the full 128 bits, and decryption failure is a
  hard error that is never swallowed or treated as empty data.
- Every encryption binds its context as additional authenticated data (AAD):
  format version, key purpose, and item identifier. A ciphertext moved to a
  different item or purpose fails authentication.
- Keys are non-extractable `CryptoKey` objects whenever the API allows it.

## Consequences

### Positive
- No new dependency; the primitive is implemented and maintained by the
  browser.
- No state to synchronize between devices.
- AAD prevents swapping ciphertexts between items or contexts.

### Negative and risks
- **IV collision bound:** random IVs limit a single key to about 2^32
  encryptions. A personal vault is far below this, but the bound must be
  documented and respected.
- **Length leakage:** ciphertext length reveals plaintext length. Padding is
  deferred to the metadata decision in the threat model.
- **Correct use is on us:** errors in AAD construction, IV generation or
  error handling would silently weaken the scheme.

### Mitigations planned
- A single encryption function is the only place that generates IVs and sets
  AAD; no other module calls the cipher directly.
- Rotating the Vault Key (re-encrypting all items) is the escape hatch if the
  encryption count ever approaches the bound.
- Tests: known-answer vectors, tamper tests (flipped ciphertext, IV, tag and
  AAD must all fail), and a test that consecutive IVs differ.

## Related decisions
- ADR 0003: key hierarchy (the keys this cipher uses).
- A later ADR will define the serialized vault format and any padding.