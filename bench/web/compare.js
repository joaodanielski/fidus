import sodium from '/vendor/libsodium-wrappers.mjs';
import setupWasm from '/vendor/argon2id/setup.js';

const out = document.getElementById('out');
const runButton = document.getElementById('run');

const MEMORIES = [19, 32, 46, 64];
const ITERATIONS = [1, 2, 3, 4];
const RUNS = 3;

function log(line) {
  out.textContent += `${line}\n`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

let variant = 'unknown';

async function loadArgon2id() {
  const load = async (name, url, importObject) => {
    const response = await fetch(url);
    const bytes = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, importObject);
    variant = name;
    return result;
  };
  return setupWasm(
    (importObject) => load('simd', '/vendor/argon2id/simd.wasm', importObject),
    (importObject) => load('no-simd', '/vendor/argon2id/no-simd.wasm', importObject)
  );
}

function deriveSodium(password, salt, iterations, memoryMiB) {
  return sodium.crypto_pwhash(
    32,
    password,
    salt,
    iterations,
    memoryMiB * 1024 * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );
}

function deriveArgon2id(argon2id, password, salt, iterations, memoryMiB) {
  return argon2id({
    password,
    salt,
    parallelism: 1,
    passes: iterations,
    memorySize: memoryMiB * 1024,
    tagLength: 32,
  });
}

function measure(fn) {
  sodium.memzero(fn()); // warm-up
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const key = fn();
    times.push(performance.now() - start);
    sodium.memzero(key);
  }
  return Math.round(median(times));
}

async function run() {
  runButton.disabled = true;
  out.textContent = '';

  try {
    await sodium.ready;
    const argon2id = await loadArgon2id();

    // Fake credentials: a benchmark must never use a real password.
    const password = new TextEncoder().encode('benchmark-only-not-a-real-password');
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

    log(navigator.userAgent);
    log(`cores: ${navigator.hardwareConcurrency ?? 'n/a'}`);
    log(`argon2id wasm variant: ${variant}`);

    // Cross-check: both libraries must derive the identical key.
    const a = deriveSodium(password, salt, 2, 19);
    const b = deriveArgon2id(argon2id, password, salt, 2, 19);
    log(`cross-check (m=19 MiB, t=2): ${sodium.memcmp(a, b) ? 'MATCH' : 'MISMATCH'}`);
    sodium.memzero(a);
    sodium.memzero(b);

    log(`${RUNS} timed runs per cell, after one warm-up.\n`);
    log('m(MiB)  t  libsodium(ms)  argon2id(ms)');

    for (const memoryMiB of MEMORIES) {
      for (const iterations of ITERATIONS) {
        await tick();
        try {
          const s = measure(() => deriveSodium(password, salt, iterations, memoryMiB));
          const w = measure(() =>
            deriveArgon2id(argon2id, password, salt, iterations, memoryMiB)
          );
          log(
            `${String(memoryMiB).padStart(6)}  ${iterations}  ` +
              `${String(s).padStart(13)}  ${String(w).padStart(12)}`
          );
        } catch (err) {
          log(`${String(memoryMiB).padStart(6)}  ${iterations}  error: ${err.message}`);
        }
      }
    }
    log('\ndone');
  } catch (err) {
    log(`failed: ${err.message}`);
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener('click', run);