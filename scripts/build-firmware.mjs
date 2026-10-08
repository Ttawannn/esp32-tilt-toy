import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir, availableParallelism } from 'node:os';
import { createHash } from 'node:crypto';
import { profiles, VERSION } from '../web/profiles.js';
import { boards, releasePath } from '../web/boards.js';
import { buildConcurrency, writeIfChanged, withBoardLock, parallelBuilds } from './firmware-build-utils.mjs';

const root = resolve(import.meta.dirname, '..');
// Each board has a persistent cache and an exclusive lock on its staged profile.
const work = process.env.FIRMWARE_WORK_DIR ? resolve(process.env.FIRMWARE_WORK_DIR) : join(root, 'work', 'firmware', 'cache');
const releases = process.env.FIRMWARE_OUTPUT_DIR ? resolve(process.env.FIRMWARE_OUTPUT_DIR) : join(root, 'web', 'firmware');
const windowsCli = join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe');
let cli = process.env.ARDUINO_CLI || 'arduino-cli';
if (!process.env.ARDUINO_CLI && process.platform === 'win32') { try { await access(windowsCli); cli = windowsCli; } catch {} }
const data = process.env.ARDUINO_DATA_DIR || (process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Arduino15') : process.platform === 'darwin' ? join(homedir(), 'Library', 'Arduino15') : join(homedir(), '.arduino15'));
const core = join(data, 'packages', 'esp32', 'hardware', 'esp32', '3.3.11');
await access(core).catch(() => { throw Error('Install esp32:esp32@3.3.11 using Arduino CLI first (see README).'); });
const toolDir = join(data, 'packages', 'esp32', 'tools', 'esptool_py', '5.3.1');
const esptool = process.env.ESPTOOL || join(toolDir, process.platform === 'win32' ? 'esptool.exe' : 'esptool');
const sketchSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'tilt_toy.ino'), 'utf8')).replace(/\r\n/g, '\n');
const configSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'config.h'), 'utf8')).replace(/\r\n/g, '\n');
const fluidSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'flip_fluid.h'), 'utf8')).replace(/\r\n/g, '\n');
const motionSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'motion_sensor.h'), 'utf8')).replace(/\r\n/g, '\n');
const stateSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'motion_state.h'), 'utf8')).replace(/\r\n/g, '\n');
const modesSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'toy_modes.h'), 'utf8')).replace(/\r\n/g, '\n');
const pixelSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'pixel_flow.h'), 'utf8')).replace(/\r\n/g, '\n');
const sourceSha256 = createHash('sha256').update(sketchSource+'\n'+configSource+'\n'+fluidSource+'\n'+motionSource+'\n'+stateSource+'\n'+modesSource+'\n'+pixelSource).digest('hex');

function run(command, args, logPath) {
  return new Promise((yes,no) => {
    const child = spawn(command,args,{cwd:root,windowsHide:true});
    let output='';
    child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
    child.on('error',no);
    child.on('close',async code=>{
      try {
        await writeFile(logPath,output);
        if(code !== 0) no(Error(output.slice(-12000) || `${command} exited with ${code}`));
        else { console.log(output.split(/\r?\n/).filter(l=>/Sketch uses|Global variables|Wrote|Successfully|bytes|Merged|tests |pass |fail |skipped /i.test(l)).slice(-8).join('\n')); yes(); }
      } catch (error) { no(error); }
    });
  });
}
let selectedProfiles = profiles, selectedBoards = boards;
let hasProfile = false, hasBoard = false;
for (const argument of process.argv.slice(2)) {
  const profile = profiles.find(p => p.id === argument), board = boards.find(b => b.id === argument);
  if (profile && !hasProfile) { selectedProfiles = [profile]; hasProfile = true; }
  else if (board && !hasBoard) { selectedBoards = [board]; hasBoard = true; }
  else throw Error(`Unknown or repeated board/display argument: ${argument}`);
}
const { parallelBoards, compileJobs } = buildConcurrency(process.env, selectedBoards.length, availableParallelism());
await mkdir(work, { recursive: true });
if (process.env.FIRMWARE_SKIP_PREFLIGHT !== '1') {
  console.log('Checking source tests before compiling firmware…');
  await run(process.execPath, [join(root, 'scripts', 'test-source.mjs')], join(work, `preflight-${process.pid}.log`));
}
await mkdir(releases, { recursive: true });
console.log(`Build cache: ${work}\nParallel boards: ${parallelBoards}; compiler jobs per board: ${compileJobs}`);
const started = performance.now();
await parallelBuilds(selectedBoards, parallelBoards, async board => {
  const boardWork = join(work, board.id);
  await withBoardLock(boardWork, async () => {
    const boardStarted = performance.now();
    const staging = join(boardWork, 'source', 'tilt_toy');
    await mkdir(staging, { recursive: true });
    await writeIfChanged(join(staging, 'tilt_toy.ino'), sketchSource);
    await writeIfChanged(join(staging, 'flip_fluid.h'), fluidSource);
    await writeIfChanged(join(staging, 'motion_sensor.h'), motionSource);
    await writeIfChanged(join(staging, 'motion_state.h'), stateSource);
    await writeIfChanged(join(staging, 'toy_modes.h'), modesSource);
    await writeIfChanged(join(staging, 'pixel_flow.h'), pixelSource);
    for(const p of selectedProfiles) {
      console.log(`Compiling ${p.id} for ${board.name} / 4MB…`);
      const output=join(boardWork,p.id); await mkdir(output,{recursive:true});
      // Only the staged sketch header changes. Share the core/library cache between profiles.
      await writeIfChanged(join(staging, 'config.h'), `#define BOARD_PROFILE ${board.firmwareId}\n#define DISPLAY_PROFILE ${p.firmwareId}\n` + configSource);
      await run(cli,['compile','--jobs',String(compileJobs),'--fqbn',board.fqbn,'--build-path',join(boardWork,'build'),'--output-dir',output,staging],join(boardWork,`${p.id}.log`));
      const merged=join(output,`${p.id}.merged.bin`);
      await run(esptool,['--chip',board.target,'merge-bin','-o',merged,'--target-offset','0x0','--flash-mode','keep','--flash-freq','keep','--flash-size','keep',`0x${board.bootloaderOffset.toString(16)}`,join(output,'tilt_toy.ino.bootloader.bin'),'0x8000',join(output,'tilt_toy.ino.partitions.bin'),'0xe000',join(core,'tools','partitions','boot_app0.bin'),'0x10000',join(output,'tilt_toy.ino.bin')],join(boardWork,`${p.id}-merge.log`));
      const binary=await readFile(merged);
      const manifest={name:`ESP32 Tilt Toy · ${board.name} · ${p.short}`,version:VERSION,board:board.id,profile:p.id,chipFamily:board.chipFamily,flashSize:'4MB',controller:p.driver,size:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),hardwareTested:false,build:{core:'esp32:esp32@3.3.11',fqbn:board.fqbn,boardProfile:board.firmwareId,bootloaderOffset:board.bootloaderOffset,displayProfile:p.firmwareId,initialRotation:p.defaultRotation||0,sourceSha256},new_install_prompt_erase:true,new_install_improv_wait_time:0,builds:[{chipFamily:board.chipFamily,parts:[{path:`./${p.id}.bin`,offset:0}]}]};
      const releaseBase = join(releases, releasePath(p, board));
      await mkdir(resolve(releaseBase, '..'), { recursive: true });
      // Merge and hash private files before publishing; another build cannot change these bytes.
      await rename(merged,`${releaseBase}.bin`);
      const stagedManifest=join(output,`${p.id}.json`);
      await writeFile(stagedManifest,JSON.stringify(manifest,null,2)+'\n');
      await rename(stagedManifest,`${releaseBase}.json`);
      console.log(`Release ${board.id}/${p.id}: ${binary.length} bytes · ${manifest.sha256.slice(0,12)}`);
    }
    console.log(`Finished ${board.id}: ${((performance.now() - boardStarted) / 1000).toFixed(1)}s`);
  });
});
console.log(`Built ${selectedBoards.length * selectedProfiles.length} images in ${((performance.now() - started) / 1000).toFixed(1)}s`);
