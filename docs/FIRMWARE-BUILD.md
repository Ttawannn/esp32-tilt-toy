# Faster firmware rebuilds

`npm run firmware` runs source tests first, then builds the selected boards and
displays. It retains the per-board core/library build cache in
`work/firmware/cache/`. Unchanged staged sources keep their timestamps. Display
profiles for one board run sequentially because they share its staged `config.h`.
Different boards can compile concurrently.

On a 16-thread host the default is two boards with eight compiler jobs each.
A single selected board gets up to twelve jobs. Smaller hosts use fewer jobs.
The build prints its cache path, concurrency, and elapsed compilation time.

## Development

Build only the hardware you are testing:

```powershell
npm run firmware -- esp32-30pin oled-128x64
```

For a complete release, run `npm run firmware` without selectors and then
`npm test`. A firmware header change requires all 18 board/display combinations
to be rebuilt so every manifest records the current source hash.

Use a host C++ compiler for all source checks. On Windows, run from a Visual
Studio developer shell with `$env:CXX = 'cl'`; CI uses the runner's `g++`.

## Overrides

| Environment variable | Purpose |
| --- | --- |
| `FIRMWARE_WORK_DIR` | Reuse an existing build directory instead of `work/firmware/cache`. |
| `FIRMWARE_BOARD_CONCURRENCY` | Number of boards built at once; set `1` for serial builds. |
| `FIRMWARE_JOBS` | Compiler jobs **per active board**; `0` delegates to Arduino's CPU detection. |
| `FIRMWARE_OUTPUT_DIR` | Write binaries/manifests to another directory instead of `web/firmware`. |
| `FIRMWARE_BOARD` | Limit release **tests** to this board; it does not select what gets built. |
| `FIRMWARE_SKIP_PREFLIGHT=1` | Skip source tests only when they already passed for the same source. |

To reuse an older `work/firmware/run-*` directory, set `FIRMWARE_WORK_DIR` to that
directory before building. Do not use another running build's board cache. A
`.build-lock/owner.json` file identifies the owning process. Normal completion
and compilation failures release the lock. After an interrupted build, verify
that the recorded process and its compiler children have stopped before
removing an abandoned `.build-lock` directory.

For measurements without changing tracked release files:

```powershell
$env:FIRMWARE_OUTPUT_DIR = 'work/firmware-benchmark/releases'
npm run firmware
npm test
```

Release tests honor `FIRMWARE_OUTPUT_DIR` and retain byte, checksum, source hash,
chip, partition, and runtime board/display/mode checks. Unset the variable when
you want to build or validate the tracked release files again.

## CI

Source tests must pass before the firmware jobs start. The three boards run as
separate matrix jobs, each building six displays and validating its own images.
CI caches the pinned Arduino toolchain/libraries and each board's staged sources
and objects. Cache keys include the runner platform, toolchain/build settings,
board, and source revision, with compatible objects restored across source
changes. Firmware is still compiled and all generated images are validated;
restoring a cache never replaces the release checks. Each board uploads its own
artifact.

## Local measurement, 2026-10-08

On the Ryzen 9 5900HX host (8 cores / 16 threads, 32 GB RAM), an unchanged
ESP32 30-pin + OLED 128×64 rebuild with a warm cache and eight compiler jobs
took 38.1 seconds with the previous script and 25.9 seconds with this script
(about 32% less time in this sample). Both builds produced the same binary
SHA-256. Source tests had already passed and were excluded from both timings.
Other compilation was active on the host; these are single-run observations,
not a promised speedup for every board or a full 18-image release.

The complete 18-image verification build took 17 minutes 50 seconds under the
host's concurrent workload. MSVC ran all 61 tests against those generated
images with zero skips; the web build and local CI YAML validation also passed.
The CI matrix/cache changes have not yet run on GitHub. Verification images
were initially written under ignored `work/`. All 18 validated images and
manifests were promoted into `web/firmware/` when the source-hash fix and build
changes were merged into `main`.
