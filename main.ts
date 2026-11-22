// Tiny stack VM for make.fun's tiny-stack-vm-01 ISA.
// Design: one opcode table drives the generic checks, and the step order
// mirrors the reference VM exactly, because the edge-case points live in
// that order: (1) step limit, (2) pc in range, (3) opcode known,
// (4) immediate fits, (5) generic stack underflow/overflow from the
// table's pops/pushes, and only then the instruction's own trap/effect.
// All values live in Int32Arrays, so arithmetic wraps to 32 bits for free;
// MUL uses Math.imul to get the exact low 32 bits of the full product.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Opcode byte -> [immediate bytes, pops, pushes]. A missing key traps 5.
const T: { [k: number]: number[] } = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2],
  5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3], 16: [0, 2, 1], 17: [0, 2, 1],
  18: [0, 2, 1], 19: [0, 2, 1], 20: [0, 2, 1], 21: [0, 2, 1], 22: [0, 2, 1],
  23: [0, 1, 1], 24: [0, 2, 1], 25: [0, 2, 1], 26: [0, 2, 1], 27: [0, 1, 1],
  28: [0, 2, 1], 29: [0, 2, 1], 30: [0, 2, 1], 32: [0, 2, 1], 33: [0, 2, 1],
  34: [0, 2, 1], 48: [2, 0, 0], 49: [2, 1, 0], 50: [2, 1, 0], 51: [2, 0, 0],
  52: [0, 0, 0], 64: [0, 1, 1], 65: [0, 2, 0], 80: [0, 1, 0], 81: [0, 1, 0],
  82: [0, 0, 1], 83: [0, 1, 0],
};
const enc = new TextEncoder();

function run(p: Uint8Array, inp: Uint8Array) {
  const n = p.length;
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let sp = 0, csp = 0, ol = 0, ip = 0, pc = 0, steps = 0;
  // A trap and a normal exit look the same here: keep the output written
  // so far and finish with the given code.
  const end = (c: number) => ({ o: out.slice(0, ol), c });
  for (;;) {
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const o = p[pc], t = T[o];
    if (!t) return end(5);
    const im = t[0], po = t[1], pu = t[2];
    if (pc + im >= n) return end(9);
    steps++;
    if (sp < po) return end(2);
    if (sp - po + pu > 256) return end(3);
    const nx = pc + 1 + im;
    pc = nx;
    switch (o) {
      case 0: return end(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const v = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = v; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r = 0;
        if (o === 16) r = a + b | 0;
        else if (o === 17) r = a - b | 0;
        else if (o === 18) r = Math.imul(a, b);
        else if (o === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (o === 20) { if (!b) return end(4); r = b === -1 ? 0 : ((a % b) | 0); }
        else if (o === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (o === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (o === 24) r = a & b;
        else if (o === 25) r = a | b;
        else if (o === 26) r = a ^ b;
        else if (o === 28) r = a << (b & 31);
        else if (o === 29) r = a >> (b & 31);
        else if (o === 30) r = (a >>> (b & 31)) | 0;
        else if (o === 32) r = a === b ? 1 : 0;
        else if (o === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        D[sp - 2] = r; sp--; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = o === 48;
        if (o !== 48) { const v = D[--sp]; take = o === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (csp === 64) return end(7);
        C[csp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52:
        if (csp === 0) return end(8);
        pc = C[--csp]; break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        D[sp - 1] = M[a]; break;
      }
      case 65: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = D[sp - 2]; sp -= 2; break;
      }
      case 80: {
        // Encode first and check the whole string: a PRINT that would
        // pass the output limit writes none of its bytes (trap 11).
        const s = enc.encode(String(D[sp - 1]));
        if (ol + s.length > 65536) return end(11);
        sp--; out.set(s, ol); ol += s.length; break;
      }
      case 81:
        if (ol + 1 > 65536) return end(11);
        out[ol++] = D[--sp] & 255; break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return end(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of readdirSync(I).sort()) {
  const r = run(
    new Uint8Array(readFileSync(join(I, id, "program.bin"))),
    new Uint8Array(readFileSync(join(I, id, "input.bin"))),
  );
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "stdout.bin"), r.o);
  writeFileSync(join(O, id, "exit.txt"), r.c + "\n");
}
