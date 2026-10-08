export const STALL_DELAY_MS = 30000;
export const DOWNLOAD_IDLE_MS = 30000;

export function progressView(state, now = Date.now()) {
  const details = state?.details || {};
  const phase = details.phase || 'connect';
  const percentage = Number.isFinite(details.percentage) ? details.percentage : undefined;
  const stalled = now - (details.updatedAt ?? now) >= STALL_DELAY_MS;
  return {
    phase, percentage,
    elapsed: Math.max(0, Math.floor((now - (details.startedAt ?? now)) / 1000)),
    idle: Math.max(0, Math.floor((now - (details.updatedAt ?? now)) / 1000)),
    hint: stalled ? (phase === 'connect' ? 'flash.bootHelp' : phase === 'download' ? 'flash.downloadHelp' : 'flash.waitHelp') : 'flash.keepOpen',
    stalled,
    bytes: Number.isFinite(details.bytesWritten) ? Math.round(details.bytesWritten / 1024) : undefined,
    total: Number.isFinite(details.bytesTotal) ? Math.round(details.bytesTotal / 1024) : undefined
  };
}

// Abort stalled network reads, including a response whose headers arrived but
// whose body stopped. A serial operation uses esptool's own command timeouts.
export async function downloadFirmware(url, onProgress, { fetchFile = fetch, idleMs = DOWNLOAD_IDLE_MS } = {}) {
  const controller = new AbortController();
  let timer, reader, timedOut = false;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, idleMs);
  };
  arm();
  try {
    const response = await fetchFile(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const length = Number(response.headers.get('content-length'));
    const total = length > 0 ? length : undefined;
    let received = 0;
    onProgress(0, total);
    if (!response.body) {
      const buffer = await response.arrayBuffer();
      onProgress(buffer.byteLength, buffer.byteLength);
      return new Uint8Array(buffer);
    }
    reader = response.body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      arm();
      onProgress(received, total);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    onProgress(received, received);
    return bytes;
  } catch (error) {
    if (timedOut) {
      const timeout = new Error('Firmware download stopped responding. Check the connection and try again.');
      timeout.translationKey = 'flash.downloadTimeout';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
}

/** @license
 * Flash sequence adapted from ESP Web Tools 10.4.0 (Apache-2.0), by the
 * Open Home Foundation: https://github.com/esphome/esp-web-tools
 * License text: licenses/esp-web-tools.txt
 * Changes: phase/log reporting, download progress and timeout, integrity
 * checks before erase, and cleanup for failures in every phase.
 */
export function createFlasher({ Transport, ESPLoader, fetchFile, now = Date.now, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), digest = bytes => crypto.subtle.digest('SHA-256', bytes) }) {
  return async function flash(onEvent, port, manifestPath, manifest, eraseFirst) {
    let build, chipFamily, loader, current, failure;
    let phase = 'connect', state = 'initializing';
    let logs = [];
    const startedAt = now();
    const report = (nextState, nextPhase, details = {}) => {
      state = nextState; phase = nextPhase;
      current = { state, message: phase, manifest, build, chipFamily, details: { ...details, phase, startedAt, updatedAt: now(), logs, eraseFirst } };
      onEvent(current);
    };
    const log = message => {
      const line = String(message).trim();
      if (!line || /^[.\s]+$/.test(line)) return;
      logs = [...logs, line].slice(-60);
      if (state === 'initializing') {
        if (/Uploading stub|Running stub|Stub running|Stub is already running/.test(line)) phase = 'stub';
        else if (/Flash ID|Manufacturer|Detected flash/.test(line)) phase = 'flash-id';
      }
      report(state, phase, current?.details);
    };
    const transport = new Transport(port);
    try {
      report('initializing', 'connect', { done: false });
      loader = new ESPLoader({ transport, baudrate: 115200, enableTracing: false, terminal: { clean() {}, write: log, writeLine: log } });
      await loader.main();
      report('initializing', 'flash-id', { done: false });
      await loader.flashId();
      chipFamily = loader.chip.CHIP_NAME;
      const info = port.getInfo();
      const serialType = info.usbVendorId === 0x303a && [0x1001, 0x1002, 0x1003, 0x0002, 0x0003].includes(info.usbProductId) ? 'cdc' : 'uart';
      build = manifest.builds.find(b => b.chipFamily === chipFamily && b.serialType === serialType)
        || manifest.builds.find(b => b.chipFamily === chipFamily && b.serialType === undefined);
      if (!build) throw Object.assign(new Error(`Detected ${chipFamily}; this firmware does not support it.`), { translationKey: 'flash.chipMismatch' });

      const manifestURL = /^(blob:|data:)/.test(manifestPath) ? location.href : new URL(manifestPath, globalThis.location?.href).href;
      const fileArray = [];
      for (const part of build.parts) {
        report('preparing', 'download', { done: false, bytesWritten: 0, bytesTotal: build.parts.length === 1 ? manifest.size : undefined });
        const data = await downloadFirmware(new URL(part.path, manifestURL).href, (received, length) => {
          const total = build.parts.length === 1 ? manifest.size || length : length;
          report('preparing', 'download', { done: false, bytesWritten: received, bytesTotal: total, percentage: total ? Math.min(100, Math.floor(received / total * 100)) : undefined });
        }, { fetchFile });
        fileArray.push({ data, address: part.offset });
      }
      // The page verified this release before enabling the button. Verify the
      // bytes fetched by the installer too, before any destructive operation.
      if (fileArray.length === 1 && manifest.sha256) {
        report('preparing', 'check', { done: false });
        const bytes = fileArray[0].data;
        const hash = Array.from(new Uint8Array(await digest(bytes)), v => v.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== manifest.size || hash !== manifest.sha256) throw Object.assign(new Error('Firmware checksum or size does not match.'), { translationKey: 'release.hashError' });
      }
      if (eraseFirst) {
        report('erasing', 'erase', { done: false });
        await loader.eraseFlash();
      }
      const totalSize = fileArray.reduce((total, file) => total + file.data.length, 0);
      const writtenByFile = fileArray.map(() => 0);
      report('writing', 'write', { percentage: 0, bytesWritten: 0, bytesTotal: totalSize });
      await loader.writeFlash({
        fileArray, flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: false, compress: true,
        reportProgress(index, written, total) {
          writtenByFile[index] = total > 0 ? Math.min(1, written / total) * fileArray[index].data.length : 0;
          const bytesWritten = writtenByFile.reduce((sum, bytes) => sum + bytes, 0);
          report('writing', 'write', { bytesWritten, bytesTotal: totalSize, percentage: Math.floor(bytesWritten / totalSize * 100) });
        }
      });
      report('writing', 'reset', { percentage: 100, bytesWritten: totalSize, bytesTotal: totalSize });
    } catch (error) {
      failure = { error, phase, state };
    } finally {
      // A failed reset must not skip closing the port or hide the first error.
      if (loader?.chip && port.writable) {
        try { await transport.setRTS(true); await delay(100); await loader.after(); }
        catch (error) { failure ||= { error, phase: 'reset', state: 'writing' }; }
      }
      try { await transport.disconnect(); }
      catch (error) { failure ||= { error, phase: 'reset', state: 'writing' }; }
    }
    // ESP Web Tools reopens the port after this event; release it first.
    if (failure) {
      const errorCode = failure.state === 'initializing' ? 'failed_initialize' : failure.state === 'preparing' ? 'failed_firmware_download' : 'write_failed';
      report('error', failure.phase, { error: errorCode, details: String(failure.error), translationKey: failure.error.translationKey, failedPhase: failure.phase });
    } else report('finished', 'done');
  };
}
