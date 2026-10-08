import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFlasher, downloadFirmware, progressView, STALL_DELAY_MS } from '../web/flash-progress.js';

const binary = new Uint8Array([0xe9, 1, 2, 3, 4, 5, 6, 7]);
const release = () => ({ size: binary.length, sha256: createHash('sha256').update(binary).digest('hex'), builds: [{ chipFamily: 'ESP32-C6', parts: [{ path: './toy.bin', offset: 0 }] }] });
const manifestURL = 'https://example.test/firmware/toy.json';

function harness({ fail, chip = 'ESP32-C6', fetchFile = async () => new Response(binary), releaseData = release() } = {}) {
  const calls = [], events = [];
  let clock = 1000;
  class Transport {
    async setRTS() { calls.push('reset'); if (fail === 'reset') throw new Error('Reset failed'); }
    async disconnect() { calls.push('disconnect'); }
  }
  class ESPLoader {
    constructor(options) { this.terminal = options.terminal; }
    async main() {
      calls.push('connect');
      if (fail === 'connect') throw new Error('Board did not respond');
      this.chip = { CHIP_NAME: chip };
      this.terminal.writeLine('Uploading stub...');
    }
    async flashId() { calls.push('chip'); }
    async eraseFlash() { calls.push('erase'); if (fail === 'erase') throw new Error('Erase failed'); }
    async writeFlash(options) {
      calls.push('write');
      assert.equal(options.eraseAll, false);
      assert.equal(options.flashMode, 'keep');
      assert.equal(options.flashFreq, 'keep');
      assert.equal(options.flashSize, 'keep');
      assert.equal(options.fileArray[0].address, 0);
      if (fail === 'write') throw new Error('Cable disconnected');
      // Report compressed bytes: 2 / 4 must map to half the original image.
      for (let i = 0; i < options.fileArray.length; i++) {
        options.reportProgress(i, 0, 4);
        options.reportProgress(i, 2, 4);
        options.reportProgress(i, 4, 4);
      }
    }
    async after() { calls.push('restart'); }
  }
  const flash = createFlasher({ Transport, ESPLoader, fetchFile, now: () => ++clock, delay: async () => {} });
  return { calls, events, run: (erase = true) => flash(event => { calls.push(`event:${event.state}`); events.push(event); }, { getInfo: () => ({ usbVendorId: 0x303a, usbProductId: 0x1001 }), writable: {} }, manifestURL, releaseData, erase) };
}

test('real phases, byte counts, and 0–100% progress reach the dialog; finish follows port release', async () => {
  const h = harness();
  await h.run();
  const phases = [...new Set(h.events.map(event => event.details.phase))];
  assert.deepEqual(phases, ['connect', 'stub', 'flash-id', 'download', 'check', 'erase', 'write', 'reset', 'done']);
  const writing = h.events.filter(event => event.details.phase === 'write');
  assert.deepEqual(writing.map(event => event.details.percentage), [0, 0, 50, 100]);
  assert.equal(writing.find(event => event.details.percentage === 50).details.bytesWritten, binary.length / 2);
  assert.equal(h.events.at(-1).chipFamily, 'ESP32-C6');
  assert.deepEqual(h.calls.slice(-2), ['disconnect', 'event:finished']);
  assert.ok(h.events.some(event => event.details.logs.includes('Uploading stub...')));
});

test('download, chip, or integrity failures prevent erase and writing', async () => {
  for (const options of [
    { fetchFile: async () => new Response('missing', { status: 404 }) },
    { chip: 'ESP32-C3' },
    { fetchFile: async () => new Response(new Uint8Array(binary.length)) }
  ]) {
    const h = harness(options);
    await h.run();
    assert.equal(h.events.at(-1).state, 'error');
    assert.ok(!h.calls.includes('erase'));
    assert.ok(!h.calls.includes('write'));
    assert.deepEqual(h.calls.slice(-2), ['disconnect', 'event:error']);
  }
});

test('connect, erase, write and reset failures are visible and still release the port', async () => {
  for (const fail of ['connect', 'erase', 'write', 'reset']) {
    const h = harness({ fail });
    await h.run();
    assert.equal(h.events.at(-1).state, 'error', fail);
    assert.equal(h.events.at(-1).details.failedPhase, fail === 'connect' ? 'connect' : fail);
    assert.deepEqual(h.calls.slice(-2), ['disconnect', 'event:error']);
    assert.ok(!h.events.some(event => event.state === 'finished'));
  }
});

test('update without erase preserves the erase choice and multipart progress does not double-count', async () => {
  const releaseData = release();
  delete releaseData.sha256;
  releaseData.builds[0].parts.push({ path: './app.bin', offset: 0x10000 });
  const h = harness({ releaseData });
  await h.run(false);
  assert.ok(!h.calls.includes('erase'));
  const writing = h.events.filter(event => event.details.phase === 'write');
  assert.deepEqual(writing.map(event => event.details.percentage), [0, 0, 25, 50, 50, 75, 100]);
  assert.equal(writing.at(-1).details.bytesWritten, binary.length * 2);
  assert.ok(h.events.every(event => event.details.eraseFirst === false));
});

test('download streams bytes and supports missing Content-Length', async () => {
  for (const headers of [{}, { 'content-length': String(binary.length) }]) {
    const progress = [];
    const bytes = await downloadFirmware(manifestURL, (...values) => progress.push(values), { fetchFile: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(binary.slice(0, 4)); controller.enqueue(binary.slice(4)); controller.close(); } }), { headers }) });
    assert.deepEqual(bytes, binary);
    assert.equal(progress[1][0], 4);
    assert.deepEqual(progress.at(-1), [binary.length, binary.length]);
    assert.equal(progress[0][1], headers['content-length'] ? binary.length : undefined);
  }
});

test('stalled response headers and stalled response bodies both abort with a retry error', async () => {
  const fetchFiles = [
    (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    async (_url, { signal }) => new Response(new ReadableStream({ start(controller) { controller.enqueue(binary.slice(0, 4)); signal.addEventListener('abort', () => controller.error(signal.reason)); } }))
  ];
  for (const fetchFile of fetchFiles) await assert.rejects(downloadFirmware(manifestURL, () => {}, { fetchFile, idleMs: 10 }), error => error.translationKey === 'flash.downloadTimeout');
});

test('elapsed and stalled feedback follow activity; unknown progress is never a fabricated percentage', () => {
  const state = { details: { phase: 'connect', startedAt: 1000, updatedAt: 2000 } };
  assert.equal(progressView(state, 2000 + STALL_DELAY_MS - 1).stalled, false);
  const stalled = progressView(state, 2000 + STALL_DELAY_MS);
  assert.equal(stalled.hint, 'flash.bootHelp');
  assert.equal(stalled.elapsed, 31);
  assert.equal(stalled.percentage, undefined);
  assert.equal(progressView({ details: { ...state.details, phase: 'write', percentage: 0 } }, 3000).percentage, 0);
  assert.equal(progressView({ details: { ...state.details, phase: 'erase' } }, 32000).hint, 'flash.waitHelp');
});
