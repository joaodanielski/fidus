import sodium from '/vendor/libsodium-wrappers.mjs';

const out = document.getElementById('out');
const runButton = document.getElementById('run');
const includeBig = document.getElementById('big');

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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function run() {
  runButton.disabled = true;
  out.textContent = '';

  try {
    await sodium.ready;

    const memories = [19, 32, 46, 64];
    if (includeBig.checked) memories.push(128);

    // Fake credentials: a benchmark must never use a real password.
    const password = 'benchmark-only-not-a-real-password';
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

    log(navigator.userAgent);
    log(`cores: ${navigator.hardwareConcurrency ?? 'n/a'}`);
    log(`deviceMemory (GB, Chrome only): ${navigator.deviceMemory ?? 'n/a'}`);
    log(`${RUNS} timed runs per configuration, after one warm-up.\n`);
    log('m(MiB)  t  median(ms)  min(ms)  max(ms)');

    for (const memoryMiB of memories) {
      for (const iterations of ITERATIONS) {
        await tick();
        try {
          sodium.memzero(derive(password, salt, iterations, memoryMiB));

          const times = [];
          for (let i = 0; i < RUNS; i++) {
            const start = performance.now();
            const key = derive(password, salt, iterations, memoryMiB);
            times.push(performance.now() - start);
            sodium.memzero(key);
          }

          log(
            `${String(memoryMiB).padStart(6)}  ${iterations}  ` +
              `${String(Math.round(median(times))).padStart(11)}  ` +
              `${String(Math.round(Math.min(...times))).padStart(7)}  ` +
              `${String(Math.round(Math.max(...times))).padStart(7)}`
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