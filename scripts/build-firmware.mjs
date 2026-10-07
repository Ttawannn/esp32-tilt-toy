import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { profiles, VERSION } from '../web/profiles.js';

const root = resolve(import.meta.dirname, '..');
const work = join(root, 'work', 'firmware');
const releases = join(root, 'web', 'firmware');
await mkdir(work, { recursive: true });
await mkdir(releases, { recursive: true });
const windowsCli = join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe');
let cli = process.env.ARDUINO_CLI || 'arduino-cli';
if (!process.env.ARDUINO_CLI && process.platform === 'win32') { try { await access(windowsCli); cli = windowsCli; } catch {} }
const data = process.env.ARDUINO_DATA_DIR || (process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Arduino15') : process.platform === 'darwin' ? join(homedir(), 'Library', 'Arduino15') : join(homedir(), '.arduino15'));
const core = join(data, 'packages', 'esp32', 'hardware', 'esp32', '3.3.11');
await access(core).catch(() => { throw Error('Install esp32:esp32@3.3.11 using Arduino CLI first (see README).'); });
const toolDir = join(data, 'packages', 'esp32', 'tools', 'esptool_py', '5.3.1');
const esptool = process.env.ESPTOOL || join(toolDir, process.platform === 'win32' ? 'esptool.exe' : 'esptool');
const fqbn = 'esp32:esp32:esp32c6:CDCOnBoot=cdc,FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app';
const staging = join(work, 'source', 'tilt_toy');
await mkdir(staging, { recursive: true });
const sketchSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'tilt_toy.ino'), 'utf8')).replace(/\r\n/g, '\n');
const configSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'config.h'), 'utf8')).replace(/\r\n/g, '\n');
const fluidSource = (await readFile(join(root, 'firmware', 'tilt_toy', 'flip_fluid.h'), 'utf8')).replace(/\r\n/g, '\n');
await writeFile(join(staging, 'tilt_toy.ino'), sketchSource);
await writeFile(join(staging, 'flip_fluid.h'), fluidSource);

function run(command, args, logPath) {
  return new Promise((yes,no) => {
    const child = spawn(command,args,{cwd:root,windowsHide:true});
    let output='';
    child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
    child.on('error',no);
    child.on('close',async code=>{
      await writeFile(logPath,output);
      if(code) no(Error(output.slice(-12000)));
      else { console.log(output.split(/\r?\n/).filter(l=>/Sketch uses|Global variables|Wrote|Successfully|bytes|Merged/i.test(l)).slice(-8).join('\n')); yes(); }
    });
  });
}
const selected = process.argv[2] ? profiles.filter(p=>p.id===process.argv[2]) : profiles;
if(!selected.length) throw Error('Unknown display profile');
for(const p of selected) {
  console.log(`Compiling ${p.id} for ESP32-C6 / 4MB…`);
  const output=join(work,p.id); await mkdir(output,{recursive:true});
  // Only the staged sketch header changes. Share the core/library cache between profiles.
  await writeFile(join(staging, 'config.h'), `#define DISPLAY_PROFILE ${p.firmwareId}\n` + configSource);
  await run(cli,['compile','--jobs',process.env.FIRMWARE_JOBS || '8','--fqbn',fqbn,'--build-path',join(work,'build'),'--output-dir',output,staging],join(work,`${p.id}.log`));
  const merged=join(releases,`${p.id}.bin`);
  await run(esptool,['--chip','esp32c6','merge-bin','-o',merged,'--flash-mode','keep','--flash-freq','keep','--flash-size','keep','0x0',join(output,'tilt_toy.ino.bootloader.bin'),'0x8000',join(output,'tilt_toy.ino.partitions.bin'),'0xe000',join(core,'tools','partitions','boot_app0.bin'),'0x10000',join(output,'tilt_toy.ino.bin')],join(work,`${p.id}-merge.log`));
  const binary=await readFile(merged);
  const manifest={name:`ESP32 Tilt Toy · ${p.short}`,version:VERSION,profile:p.id,chipFamily:'ESP32-C6',flashSize:'4MB',controller:p.driver,size:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),hardwareTested:false,build:{core:'esp32:esp32@3.3.11',fqbn,displayProfile:p.firmwareId,sourceSha256:createHash('sha256').update(sketchSource+'\n'+configSource+'\n'+fluidSource).digest('hex')},new_install_prompt_erase:true,new_install_improv_wait_time:0,builds:[{chipFamily:'ESP32-C6',parts:[{path:`./${p.id}.bin`,offset:0}]}]};
  await writeFile(join(releases,`${p.id}.json`),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Release ${p.id}: ${binary.length} bytes · ${manifest.sha256.slice(0,12)}`);
}
