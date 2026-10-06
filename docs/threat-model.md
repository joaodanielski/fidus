# Threat Model

Status: initial version. This document will be refined into a STRIDE analysis
per component once the architecture is defined.

## Scope and assumptions

Fidus is a zero-knowledge password manager: encryption and decryption happen
on the client, and the server stores only data it cannot read. This model
covers the client, the sync server and the network between them.

Assumptions:
- The user's device and browser are not already compromised.
- TLS is correctly deployed and the user verifies they are visiting the right
  origin.
- The cryptographic primitives (Argon2id, AES-256-GCM, HKDF, SHA-256) are
  sound; implementation errors are the risk, not the algorithms.

## Assets

| Asset | Why it matters |
|---|---|
| Master password | Root secret; never stored, never sent to the server |
| Derived keys and vault key | Decrypt everything; must stay on the client |
| Decrypted vault entries | The data the user actually wants to protect |
| Encrypted vault | Stored by the server; its confidentiality rests on the keys |
| Authentication secret | Lets the server authenticate the user without the password |
| Salt and KDF parameters | Public by design, but must be unique and authentic |
| Metadata (item count, sizes, timestamps) | May leak behavior even when contents are encrypted |

## Adversaries and defenses

| Adversary | Capability | Main defenses | Residual risk |
|---|---|---|---|
| Compromised server or database leak | Reads everything stored | Client-side encryption; server holds only ciphertext and a re-hashed authentication secret | Metadata exposure; weak master password |
| Attacker with a stolen vault (offline) | Unlimited guessing, specialized hardware | Argon2id, memory-hard (ADR 0001); unique salt | Limited by master password strength; a common password falls quickly |
| Network attacker (MITM) | Reads or alters traffic | TLS with HSTS; authentication secret instead of the password | Misconfigured TLS |
| Malicious script (XSS) | Runs code in the app origin | Strict CSP, no inline scripts, minimal dependencies | Script in the app origin can read decrypted data in memory; cannot be fully eliminated |
| Supply chain (npm packages, WASM artifact) | Code running with access to secrets | Pinned versions, lockfile, vendored and verified WASM, few dependencies | Compromised dependency before review |
| Local attacker or malware on the device | Memory dump, storage access, keylogging | Auto-lock, keys never persisted in browser storage | Largely out of scope (see below) |

## Security goals

- **Confidentiality:** the server and the network learn nothing about vault
  contents or the master password.
- **Integrity:** tampering with stored ciphertext is detected (authenticated
  encryption).
- **No silent weakening:** KDF parameters and format version are authenticated
  and cannot be downgraded by the server.

## Out of scope

- A device already compromised by malware or a keylogger.
- Weak master passwords chosen by the user; the system can guide and warn, but
  cannot compensate.
- Social engineering and phishing of the user.
- Side-channel attacks on the user's hardware.

## Open questions (to resolve with STRIDE)

- Which metadata is encrypted, and which is exposed to the server?
- Can the server replay an older, valid vault version (rollback attack)?
  Authenticated encryption alone does not prevent this.
- How are KDF parameters authenticated so the server cannot downgrade them?
- Account recovery: zero-knowledge implies none; confirm the policy.
- How are conflicts resolved when two devices edit offline?