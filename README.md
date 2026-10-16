# esp32-tilt-toy

**English** · [ภาษาไทย](README.th.md)

A pocket toy built with an **ESP32 30-pin / ESP32-C3 SuperMini / ESP32-C6 SuperMini + BMI160 / MPU6050**. Play by tilting and shaking it. The web app lets you choose a board, display, and sensor, try the modes, and flash over USB. The device also serves a settings page you can open from your phone.

**Web installer and preview:** [Open ESP32 Tilt Toy](https://ttawannn.github.io/esp32-tilt-toy/)

## Language

The installer and preview open in **English** by default. Use the **ภาษาไทย** button in the top bar to switch to Thai, or **English** to switch back. Your browser remembers the language. Switching updates the controls, mode descriptions, wiring diagram, pin pairs, and firmware status without changing the selected hardware, mode, or completed practice connections.

For the Thai documentation, open [README.th.md](README.th.md). The device settings page described below is served separately by the firmware.

## Since v0.1.4

- **Five modes**: Liquid, Slosh water, Pixel Flow, Pocket eyes, and Robot eyes. Inertia, Swirl, and Full-motion water, Tilt maze, Snow globe, Orbit pong, and Shake & roll were removed. A toy saved on a removed mode starts on Liquid.
- **Robot eyes** with eight moods, chosen on the phone, or *Play all moods* to cycle through them. See [Device modes](#device-modes).
- **Axis setup on the toy**: hold BOOT for 5 seconds (or tap *Auto axis setup* on the phone page). Lay the toy flat with the screen up until the bar fills, then stand it on its bottom edge. It works out which sensor axis points where and saves it, so the module can be mounted in any square orientation.
- **Accelerometer sign fixed**: sensors report +1 g pointing up at rest; the motion filter now treats gravity as its opposite. The screen axes on the phone page (X right, Y down, Z into the screen) now match the physical directions. The web preview's simulated sensor follows the same convention.
- **Arduino IDE sketch**: under the flash button, *Edit the code in Arduino IDE* offers one `.ino` for the selected board and display (download, copy, or view), the Tools settings with what each one does, and the libraries to install. `npm run build` writes all 18 sketches to `dist/arduino/` from `firmware/tilt_toy` with `scripts/arduino-sketch.mjs`: the local headers are inlined, the board and display are fixed by `#define`, and only that display's library is included.
- **Serial Monitor (115200)**: reset reason at boot, BOOT button and Wi-Fi events, and FPS / solver time every second.
- **Slosh water**: Liquid that also takes the toy's measured translation and rotation, so moving or rocking it leaves the water behind and it sloshes back. Pixel Flow now uses the same grid as Liquid on every display.
- **Fixed-point water**: the FLIP solver runs in integer Q16 so the FPU-less C3/C6 keep up; see [FLIP/PIC water](#flippic-water).

## New in v0.1.4

- **Pixel Flow (`pixel-flow`)**: Each water drop occupies one LED-style grid cell. Surface drops are brighter; individual drops can splash. The surface follows the actual tilt angle. The simulation uses integer arithmetic, and TFT displays update only changed drops at 30 Hz.
- **Full-motion water (`water-full`)**: Combines the existing FLIP solver with tilt, jolts, and rotation in one mode. The preview has its own colors and blending, continuous ±180° tilt, and a spin demo.

There are now 10 modes. Existing NVS IDs 0–7 are unchanged.

## New in v0.1.3

- Read BMI160 / MPU6050 FIFO samples at 100 Hz; increase the gyro range to ±2000°/s to capture rotation while transmitting display frames.
- Fuse accelerometer and gyro measurements into a quaternion and separate translation from gravity. Liquid uses tilt, Inertia water opposes jolts, and Swirl water adds Euler, Coriolis, and centrifugal forces around the screen axis.
- Set the X/Y/Z axis mapping and signs from a phone. Save them in NVS and apply them to both accelerometer and gyro measurements at every display rotation.
- The phone page shows gravity, angular velocity, and translation on each axis. The preview offers lay-flat, spin, stop-spin, and four-direction jolt controls.

This implements the motion foundation and the water modes of the 6DOF plan.

## Device modes

Every firmware includes five modes. Tap the **onboard BOOT button** to cycle through them. The full display is a play area, without mode labels, numbers, or frames; those values appear on the phone page. On-device text is limited to the Wi-Fi name and IP address during setup, and `IMU NOT FOUND` when the sensor is missing.

| Mode | How to play |
| --- | --- |
| **Liquid (`water`)** | Water follows tilt; shake to make waves. Square pixels and a pale surface. |
| **Slosh water (`water-slosh`)** | Same look as Liquid, but it sloshes like real water when you move or rock the toy side to side: measured translation and rotation, no wall drag. Shake still makes waves. |
| **Lying flat** | Liquid and Slosh water switch to a view from above: after 0.4 s within about 9° of flat, the water spreads from where it was over the whole floor, darker in the middle like a shallow dish. A small tilt drains the high side to bare floor with a light shoreline; standing the toy up past about 17° draws it back into the side view. The tilt is smoothed and shades change only past a margin, so sensor noise does not flicker it. The web preview has a *Lay flat* button. |
| **Pixel Flow (`pixel-flow`)** | LED-style water drops. Tilt to flow, jolt to surge, and shake to splash. |
| **Pocket eyes (`pet`)** | Cartoon eyes follow your tilt. |
| **Robot eyes (`robot`)** | Robot eyes that blink, glance around, and follow your tilt. Pick a mood on the phone: normal, happy, angry, sad, sleepy, surprised, suspicious, or in love; *Play all moods* (`auto`) shows each one for 3.5 s in turn. A shake makes them dizzy: spinning spirals for about 2 s (longer if you keep shaking), then back to the mood. |

### FLIP/PIC water

The fluid simulation uses a FLIP/PIC solver on a MAC grid, adapted from Matthias Müller's [Ten Minute Physics #18](https://matthias-research.github.io/pages/tenMinutePhysics/18-flip.html) under the MIT license. The ESP32-C3 and C6 have no floating-point unit, so the solver runs in Q16 fixed point: every per-particle and per-cell step is integer, and float math is left only for per-frame setup. Two implementations give bit-identical results:

- `firmware/tilt_toy/flip_fluid.h`: C++ with fixed storage for up to 400 cells and 900 particles, about 32 KB including the pixel grid. No runtime allocation.
- `web/fluid.js`: JavaScript for the web preview, mirroring each integer operation. A test runs 300 mixed-force steps in both and requires every value to match.

Liquid, Slosh water, and Pixel Flow support 10–90% fill. BOOT order: Liquid → Slosh water → Pixel Flow → Pocket eyes → Robot eyes. NVS key `toyMode` stores 0 Liquid, 1 Pixel Flow, 2 Pocket eyes, 3 Robot eyes, 4 Slosh water; `robotMood` stores the chosen mood, `waterGradient` the water colour and `theme` the colour theme. Firmware from before the removal saved a ten-mode index under `mode`; the first boot converts it, keeping Pixel Flow and Pocket eyes and starting removed modes on Liquid.

Both implementations use a fixed 25 ms step (at most two per frame, so a late frame cannot snowball), a circular vessel for GC9A01, linked-cell neighbor lookup, and gravity from the detected sensor's motion filter. Liquid uses tilt only; Slosh water adds the frame's translation and the Euler, Coriolis, and centrifugal forces of turning about the screen axis. Grid dimensions depend on the display; the round display uses 20×20.

Measure solver time on each physical board using **Solver** on the phone page, or `simMs` from `/api/status`. If it exceeds roughly 25 ms, reduce the grid size or fill level to avoid stuttering. The license is in [web/licenses/ten-minute-physics.txt](web/licenses/ten-minute-physics.txt) and at `/license` on the device.

### Pixel Flow

Pixel Flow does not use FLIP. Each drop occupies a grid cell and keeps its own Q8 fixed-point velocity. At 30 Hz, drops deepest along gravity move first. Collisions deflect them 45° downhill; resting drops flow sideways to level the surface. Up to three drops move from the highest to the lowest surface point per step, so the surface follows the actual tilt angle instead of only eight grid directions. Forces are gravity plus jolts (translation past a 0.4 m/s² deadband); rotation is not used.

- `firmware/tilt_toy/pixel_flow.h` (`PixelDrops`) and `web/pixel-flow.js` use integer arithmetic and produce bit-for-bit identical results, checked by C++/JS parity tests. Fixed storage supports up to 2,048 cells / 1,900 drops, about 31 KB plus 2 KB in the sketch for the previously sent frame.
- Grids match the Liquid water pixels on every display: 240×240 TFT uses 7 px pitch (6 px drop + 1 px gap), 33×33 cells; Mini TFT uses 3 px pitch, 25×52 / 52×25; OLED uses 3 px pitch, 41×20. Square TFT vessels have rounded corners; GC9A01 is circular; OLED is rectangular.
- Shading distinguishes surface, fast spray, and four body depths, with slowly changing highlights. Small gaps within a water mass render as water.
- TFT rendering bypasses the framebuffer and writes only changed drops. OLED, Wi-Fi screens, and `IMU NOT FOUND` retain the existing rendering path. OLED frames remain at 50 ms because the display shares I²C with the sensor.
- `/api/status` reports this mode's `simMs` and `particles` while it is active.

## Supported boards

| Web selection | Chip / module | Flashing connection | Flash |
| --- | --- | --- | --- |
| ESP32 30-pin | ESP32, 30-pin ESP-WROOM-32 / DevKit V1 | Onboard USB-to-Serial | 4 MB |
| ESP32-C3 SuperMini | ESP32-C3 | USB Serial/JTAG | 4 MB |
| ESP32-C6 SuperMini | ESP32-C6 | USB Serial/JTAG | 4 MB |

Choose the **Board model** before the display. The web app changes the GPIO diagram and firmware for that board and remembers the selection after reload. A browser without a saved board starts with C6. The ESP32 30-pin profile targets the ESP-WROOM-32 / DevKit V1 layouts above; check the GPIO labels printed on your own board. The installer checks the chip before flashing. See [hardware details](docs/HARDWARE.md).

## Supported displays

| Display | Controller / connection | Firmware profile |
| --- | --- | --- |
| Mini TFT 80×160, portrait | ST7735S Mini 160×80, SPI, rotation 0 | `tft-80x160` |
| Mini TFT 160×80, landscape | Same ST7735S module, SPI, rotation 1 | `tft-80x160-landscape` |
| GMT130 240×240 | ST7789, 7 pins without CS, SPI Mode 3 | `gmt130-240x240` |
| Round TFT 240×240 | GC9A01, SPI | `tft-240x240-gc9a01` |
| OLED 128×64 | SSD1306, I²C 0x3C/0x3D | `oled-128x64` |

Select **TFT 80×160 → Display orientation → Portrait / Landscape**. The preview and flash image follow the selection, which is remembered after reload. Installing the other Mini TFT orientation applies the new profile's rotation even if NVS holds an old value. Later phone changes remain saved across boots; select display rotation and save on the device page.

Each board/display pair has its own merged binary: **15 images, 4 MB flash**. The web app verifies chip, board, display, and checksum before enabling flashing. All manifests specify `hardwareTested: false`: physical board/display testing and FPS, power, and battery-life measurements are still pending. SH1106 displays and ST7735 modules with different offsets require additional profiles.

## Wiring at a glance

| Signal | ESP32 30-pin | C3 SuperMini | C6 SuperMini |
| --- | --- | --- | --- |
| I²C SDA / SCL: BMI160, MPU6050, OLED | 21 / 22 | 4 / 5 | 0 / 1 |
| SPI SCK / MOSI | 18 / 23 | 6 / 7 | 6 / 7 |
| CS / DC / RST | 27 / 26 / 25 | 10 / 3 / 1 | 18 / 19 / 20 |
| Onboard BOOT: no extra wiring | 0 | 9 | 9 |

After startup, tap BOOT to change modes. Hold it and let go after 2 seconds to toggle Wi-Fi, or after 5 seconds to start axis setup; while you hold, the screen says which one you will get. RST restarts the toy. Release BOOT at power-on or reset for normal startup; holding it then enters flashing mode. See [ESP32-C6 boot mode selection](https://docs.espressif.com/projects/esptool/en/latest/esp32c6/advanced-topics/boot-mode-selection.html).

Full wiring, backlight power guidance, and a hardware test checklist are in [docs/HARDWARE.md](docs/HARDWARE.md).

### Sensor modules

All display firmware profiles detect the sensor by Chip ID at startup; no separate sensor builds are needed. Choose **Sensor module** in the web app to show the correct wiring. Connect one sensor per toy and align its axes with the display.

| Sensor | Detected I²C addresses | I²C / address selection | Motion |
| --- | --- | --- | --- |
| BMI160 | `0x68` / `0x69` | CS/CSB → 3V3; SDO/SA0 → GND for `0x68`, or 3V3 for `0x69` | Accelerometer + gyro |
| MPU6050 / GY-521 | `0x68` / `0x69` | AD0 → GND for `0x68`, or 3V3 for `0x69` | Accelerometer + gyro |

Both are 6-axis IMUs, configured at about 100 Hz, ±8 g acceleration, and ±2000°/s gyro. FIFO batches feed sensor fusion one sample at a time at 10 ms. Roll/pitch come from filtered gravity; yaw is relative and may drift because there is no compass. Five consecutive I²C failures mark the sensor missing; check wiring and restart.

The web diagram shows components and wires for the selected board, display, and sensor, with a pin-to-pin list. Select a wire to highlight both endpoints. **Try wiring it** supports dragging, tapping two pins, or using the keyboard. It checks each pair and counts completed wires using the board's firmware GPIO mapping. Headers match common physical module layouts; always check the labels printed on your own module.

## Flash from the web

1. Open the installer in **desktop Chrome / Edge**, over HTTPS or localhost.
2. Choose your board and display. The app verifies the chip, file size, and SHA-256 before enabling the flash button.
3. Connect a USB data cable and click **Connect and flash**. For a first installation, choose erase to start with the profile defaults. Erasing deletes saved settings.

If the port is missing, close Serial Monitor, hold BOOT while plugging in USB, release it, and try again.

The installation dialog shows the current step, elapsed time, firmware download progress, and writing progress starting at 0%. Open **Show installation log** to see the loader output. If it waits for the bootloader without a new update for 30 seconds, it shows BOOT/RST instructions. A firmware download with no new data for 30 seconds fails with a retry message; serial operations use esptool's command timeouts.

The preview works without a board. Sliders simulate tilt and pitch; controls let you shake, adjust fill, show the FLIP grid, and drag to stir water. Slosh water and Pixel Flow offer four-direction jolts; Slosh water also turns the vessel at a hand-like rate when you move the tilt sliders. Pixel Flow supports dragging. Controls follow the selected mode.

## Configure from your phone

1. After startup, hold the onboard BOOT button for 2 seconds, then let go, to enable Wi-Fi.
2. Join `TiltToy-xxxx` with password `tilttoy32`, then open `http://192.168.4.1`.
3. Live values update every second: mode, roll/pitch, FPS, water solver time and particles, and free heap.
4. Set mode, fill, sensitivity, and display rotation, then save. TFT profiles support inversion; ST7789 supports SPI mode selection. Settings persist in NVS.
5. Turn off Wi-Fi to keep playing, or let it close after 3 minutes.

The device page shows the board name and detected sensor name/address. Keep the toy still at startup or when calibrating the BMI160 / MPU6050 gyro. Use the axis test panel to align X right, Y down, and Z into the screen. Select unique axes and a right-handed rotation; reverse two signs together when needed. Calibration while moving is rejected.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/status` | Version, `board`, `boardName`, `chipFamily`, profile, mode, `mood`, `waterColor`, `theme`, settings, `imu`, `sensor`, `sensorAddress` (decimal), `gyro`, roll/pitch, `fps`, `simMs`, `particles`, `freeHeap`, `axisX/Y/Z`, X/Y/Z arrays `gravity`, `omega`, `linear`, `yaw`, `stillMs`, `fifoResets` |
| `POST /api/config` | `mode`, `fill`, `sensitivity`, `rotation`, `invert`, `spiMode`, `axisX`, `axisY`, `axisZ` (±1=X, ±2=Y, ±3=Z) |
| `POST /api/shake` · `/api/calibrate` · `/api/close` | Shake, calibrate gyro, close Wi-Fi |
| `GET /license` | FLIP solver MIT license |

Accepted mode IDs: `water`, `water-slosh`, `pixel-flow`, `pet`, `robot`. Accepted `mood` IDs: `auto`, `normal`, `happy`, `angry`, `sad`, `tired`, `surprised`, `suspicious`, `love`. Accepted `waterColor`: `classic` (two-tone) or `gradient` (Liquid and Slosh water shaded by depth in the Pixel Flow palette, without its shimmer; a pixel changes shade only when its depth moves past its band by a whole pixel, so ripples do not flicker the water below). Accepted `theme`: `ocean` (the original blue), `lava`, `slime`, `grape`, `candy`, `aurora`; it colours Liquid, Slosh water, Pixel Flow and Robot eyes, and the web preview offers the same swatches.

## Local development

Use Node.js 22 or newer. Prebuilt images in `web/firmware/` let you run the web app without an Arduino toolchain.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`. `npm run dev` serves the live files in `web/`, so the preview shows edits on reload; the USB installer bundle and the Arduino IDE sketches come from `npm run build`. The app starts in English unless this browser has saved Thai as its language.

### Rebuild firmware

Install Arduino CLI 1.5.1 and the core/libraries below, or use the CLI bundled with Arduino IDE. The script finds standard Windows installation paths automatically.

```sh
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32@3.3.11
arduino-cli lib install "Adafruit GFX Library@1.12.6" "Adafruit BusIO@1.17.4" "Adafruit ST7735 and ST7789 Library@1.11.0" "Adafruit GC9A01A@1.1.1" "Adafruit SSD1306@2.5.17" "Adafruit Unified Sensor@1.1.15"
npm run firmware
npm test
npm run build
```

`npm run firmware` builds all 15 images. Select a board or display: `npm run firmware -- esp32-c3-supermini` builds five display profiles; `npm run firmware -- tft-240x240-gc9a01` builds three boards; `npm run firmware -- esp32-30pin oled-128x64` builds one image, the quickest way to try a change on a board. Boards build in parallel: up to three at once on a machine with 12 or more CPU threads; `FIRMWARE_BOARD_CONCURRENCY` and `FIRMWARE_JOBS` (compiler jobs per board) override this. On Windows, excluding `work\` and `%LOCALAPPDATA%\Arduino15` from Microsoft Defender real-time scanning can shorten builds a lot. Set `ARDUINO_CLI`, `ARDUINO_DATA_DIR`, or `ESPTOOL` for tools installed elsewhere.

The script:

1. Stages `tilt_toy.ino`, `config.h`, `flip_fluid.h`, `motion_sensor.h`, `motion_state.h`, `pixel_flow.h`, `toy_modes.h`, and `robot_eyes.h`.
2. Compiles with the board FQBN: `esp32:esp32:esp32`, `esp32c3`, or `esp32c6`, DIO, 4 MB flash, and `huge_app` (3 MB app, no OTA). C3/C6 enable USB CDC.
3. Merges bootloader at 0x1000 for ESP32 or 0 for C3/C6, partitions at 0x8000, boot_app0 at 0xe000, and app at 0x10000 into one image flashed at 0. ESP32 images include leading padding.
4. Writes manifests with binary SHA-256 and `sourceSha256` for the staged firmware sources.

Build output goes to `work/firmware/run-<pid>/<board-id>/`. Runs and boards use separate staging/cache directories to prevent concurrent builds from mixing profiles. C6 artifacts stay in `web/firmware/` to preserve existing URLs; ESP32 and C3 use `esp32-30pin/` and `esp32-c3-supermini/`. Tests fail if firmware sources change without rebuilding images. Use `FIRMWARE_WORK_DIR` to reuse a cache when no other build is using that directory.

In Arduino IDE, choose ESP32 Dev Module, ESP32C3 Dev Module, or ESP32C6 Dev Module with the flash/partition options in `web/boards.js`. `config.h` selects GPIOs from the target chip. An incompatible `BOARD_PROFILE` fails compilation.

The sensor driver uses `Wire` directly; no additional sensor library is needed. Tests compile the C++ driver against a simulated I²C bus and check JS/C++ parity using `g++`, or the compiler in `CXX` (`clang++` / `cl` also work). Tests needing C++ are skipped when no host compiler is available. For MSVC, run from a Developer Command Prompt with `CXX=cl`.

## Repository layout

- `firmware/tilt_toy/`: sketch, IMU, 5 modes, FLIP and Pixel Flow solvers, robot eyes, Wi-Fi UI, NVS.
- `web/`: installer, preview, English/Thai UI copy in `i18n.js`, profile contract, firmware artifacts, and licenses.
- `scripts/`: web build, firmware build/merge, and local server.
- `tests/`: profiles, wiring, binary chip/header, partitions, checksums, source hashes, and motion/simulation parity.
- `docs/`: [Development plan](docs/PLAN.md), [Hardware](docs/HARDWARE.md), [Validation](docs/VALIDATION.md), and [GitHub Pages](docs/GITHUB-PAGES.md).
- `.github/workflows/`: `ci.yml` checks the web app and builds all firmware profiles; `pages.yml` deploys the web app when `main` is pushed.

The web build produces static files in `dist/` with bundled ESP Web Tools. It can run on any HTTPS static host.

## Credits

- FLIP fluid is adapted from Matthias Müller's Ten Minute Physics under the [MIT license](web/licenses/ten-minute-physics.txt).
- USB flashing uses [ESP Web Tools](https://esphome.github.io/esp-web-tools/).
