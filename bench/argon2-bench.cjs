'use strict';

const os = require('node:os');
const sodium = require('libsodium-wrappers-sumo');

const MEMORY_MIB = [19, 32, 46, 64, 128, 256];
const ITERATIONS = [1, 2, 3, 4];
const RUNS = 5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function derive(password, salt, iterations, memoryMiB) {
  return sodium.crypto_pwhash(
    32,
    password,
    salt,
    iterations,
    memoryMiB * 1024 * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );
}

async function main() {
  await sodium.ready;

  // Fake credentials: a benchmark must never use a real password.
  const password = 'benchmark-only-not-a-real-password';
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  console.log(
    `Node ${process.version} | ${os.platform()} ${os.arch()} | ${os.cpus()[0].model}`
  );
  console.log(`${RUNS} timed runs per configuration, after one warm-up run.\n`);

  const rows = [];
  for (const memoryMiB of MEMORY_MIB) {
    for (const iterations of ITERATIONS) {
      try {
        // Warm-up: the first call grows WASM memory and is not representative.
        sodium.memzero(derive(password, salt, iterations, memoryMiB));

        const times = [];
        for (let i = 0; i < RUNS; i++) {
          const start = performance.now();
          const key = derive(password, salt, iterations, memoryMiB);
          times.push(performance.now() - start);
          sodium.memzero(key);
        }

        rows.push({
          'm (MiB)': memoryMiB,
          t: iterations,
          'median (ms)': Math.round(median(times)),
          'min (ms)': Math.round(Math.min(...times)),
          'max (ms)': Math.round(Math.max(...times)),
        });
      } catch (err) {
        rows.push({
          'm (MiB)': memoryMiB,
          t: iterations,
          'median (ms)': `error: ${err.message}`,
        });
      }
    }
  }

  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});