# ADR 0003: Key hierarchy and authentication secret

- Status: Accepted
- Date: 2026-10-06

## Context

Fidus must let the user prove their identity to the server and decrypt their
vault using a single master password, without the server ever being able to
decrypt anything. If one value served both purposes, the server, which must
receive the authentication value, could derive the encryption key.

The design must also allow the master password to be changed without
re-encrypting every vault item.

## Options considered

1. **Envelope encryption with HKDF.** The KDF output is split with HKDF into
   independent keys; a random Vault Key encrypts the data and is itself
   wrapped by a key derived from the password.
   Pros: separation of authentication and encryption; cheap password changes;
   established pattern. Cons: more components to implement and test.

2. **Single key derived from the password, used directly on the vault.**
   Pros: simplest. Cons: changing the password requires re-encrypting
   everything; no separation between authentication and encryption; no room
   for future features such as recovery or sharing.

3. **Two independent Argon2id runs (one for authentication, one for
   encryption).**
   Pros: full separation without HKDF. Cons: doubles the CPU and memory cost
   on the client with no security gain over HKDF.

## Decision

Use envelope encryption with HKDF.

1. Argon2id (ADR 0001) derives a 256-bit master secret from the master
   password and a per-user random salt.
2. HKDF-SHA256 derives two independent keys from the master secret, with
   distinct, versioned `info` labels: a Key Encryption Key (KEK) and an
   authentication secret. Neither is derivable from the other.
3. A random 256-bit Vault Key is generated with `crypto.getRandomValues` and
   encrypts the vault items.
4. The KEK encrypts (wraps) the Vault Key with an authenticated cipher.
5. Only the authentication secret is sent to the server, which stores a hash
   of it, never the value itself, and compares it in constant time.

The master password, master secret, KEK and Vault Key never leave the client
in clear form. The `info` labels are constants in the code and are never
reused for another purpose.

## Consequences

### Positive
- The server cannot derive the KEK or the Vault Key from the authentication
  secret.
- Changing the master password only re-wraps the Vault Key.
- Clear separation of cryptographic domains, using a standard construction.

### Negative and risks
- **Password change is not key rotation.** Someone who copied an old vault
  and later learns the old password can still recover the old Vault Key.
  Rotating the Vault Key requires re-encrypting all items and is a separate
  operation.
- **Offline guessing via the authentication secret.** A server leak lets an
  attacker test password guesses against the authentication secret, giving
  the same guessing power as a stolen vault. Argon2id and master password
  strength are the only barriers.
- **Wrapped key integrity.** A malicious server could withhold or replace the
  wrapped Vault Key or serve an older version (see rollback in the threat
  model).
- More moving parts than a single-key design, which increases the testing
  burden.

### Mitigations planned
- Distinct, versioned `info` labels covered by unit tests, including a test
  that the two derived keys differ.
- Server stores only a hash of the authentication secret, compared with a
  constant-time function.
- Bind the format version and key purpose to ciphertexts as associated data.
- Test vectors for HKDF (RFC 5869) and Argon2id (RFC 9106).

## Related decisions
- ADR 0004 (pending): symmetric cipher and nonce/IV strategy.
- ADR 0005 (pending): authentication protocol and server-side storage of the
  authentication secret.
- ADR 0002 (pending): Argon2id library and parameters.