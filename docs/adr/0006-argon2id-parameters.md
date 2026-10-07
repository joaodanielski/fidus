# ADR 0006: Argon2id parameters

- Status: Accepted
- Date: 2026-10-07

## Context

ADR 0001 chose Argon2id and ADR 0002 chose libsodium as the implementation.
The cost parameters remained open. libsodium fixes parallelism at 1, so only
memory (m) and iterations (t) are tunable.

The OWASP Password Storage Cheat Sheet lists several minimum configurations
of equivalent strength that trade memory for CPU: 46 MiB with t=1, 19 MiB
with t=2, 12 MiB with t=3, 9 MiB with t=4 and 7 MiB with t=5, all with
p=1. It also advises that a single hash should take under one second.

The parameters are stored with the vault and must be the same on every
device, so the slowest supported device sets the cost for all of them.

### Evidence

Benchmarks live in `bench/` (derivation of a fake password, median of three
or five runs after a warm-up, main thread, not a Web Worker). Medians in
milliseconds:

| m (MiB) / t | iPhone 13, Safari (libsodium) | PC, i7-13700HX (Firefox, Chrome, Node) |
|---|---|---|
| 19 / 2 | 747 to 828 | 23 to 25 |
| 46 / 1 | 867 to 1010 | 25 to 30 |
| 19 / 3 | 1144 to 1267 | 32 to 39 |
| 64 / 1 | 1305 to 1348 | 35 to 43 |
| 64 / 3 | 4301 to 4549 | 116 to 142 |

- The iPhone 13 is about 30 times slower than the PC for the same
  parameters. A second implementation (`argon2id` from the OpenPGP.js
  project, SIMD variant) was only about 10% faster on the iPhone, so the
  slowness comes from the platform and not from libsodium.
- Both implementations derive the same key for the same inputs on the PC
  and on the iPhone (cross-check of 19 MiB, t=2).
- Runs at 32 MiB showed erratic outliers on the iPhone (up to 23.7 s); the
  other sizes were stable.

## Options considered

1. **19 MiB, t=2, p=1.** OWASP minimum. About 0.75 to 0.83 s on the iPhone 13
   and about 25 ms on the PC. Lowest memory use of the options within the
   time budget.
2. **46 MiB, t=1, p=1.** OWASP-equivalent. About 0.87 to 1.01 s on the iPhone
   13, at the edge of the budget, and more memory.
3. **19 MiB, t=3, p=1.** Above the OWASP minimum, but about 1.1 to 1.3 s on
   the iPhone 13.
4. **64 MiB, t=3 or higher.** Closer to the RFC 9106 second recommended
   option, but 4 seconds or more on the iPhone 13 with p=1.

## Decision

Use Argon2id with:

- memory: 19 MiB (19456 KiB; `memlimit` of 19 * 1024 * 1024 bytes in
  libsodium)
- iterations (t): 2
- parallelism (p): 1, fixed by libsodium
- salt: 16 random bytes per vault, generated with a CSPRNG
- output: 32 bytes

The parameter set and a KDF version identifier are stored with the vault.

The client validates parameters read from the vault before deriving anything:
it rejects values below the OWASP minimum (so a malicious server cannot
downgrade the derivation) and values above a fixed upper bound (so a
malicious server cannot force excessive memory or time use).

## Consequences

### Positive
- Meets the OWASP minimum and the one-second guidance on the slowest target
  device, with room if the device heats up.
- Low memory pressure on mobile browsers.
- Parameters can be raised later: the next successful login re-derives the
  keys with stronger parameters and rewraps the Vault Key.

### Negative and risks
- **No margin above the minimum.** With the current platform cost, a
  one-second budget on the iPhone 13 buys exactly the OWASP floor. Security
  rests heavily on the strength of the master password.
- **Benchmark limits.** One slow device, main thread instead of a Web Worker,
  fake inputs. Results must be re-measured with the real worker
  implementation.
- **Parameter downgrade or abuse via the server.** Mitigated by the minimum
  and maximum checks above; how parameters are authenticated is still an
  open question in the threat model.
- Hardware and browsers change, so these values will age.

### Mitigations planned
- Re-run the benchmark inside a Web Worker when the cryptographic core
  exists, and revisit the parameters.
- Implement and test the parameter validation (bounds, version) in the KDF
  module.
- Guide users toward long passphrases and check master passwords against
  known weak lists.

## Related decisions
- ADR 0001: Argon2id as KDF. ADR 0002: libsodium as implementation.
- ADR 0005 (reserved, pending): authentication protocol and server-side
  storage of the authentication secret.
- Pending: Unicode normalization of the master password before derivation,
  decided together with the cryptographic core.