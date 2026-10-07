#pragma once
#ifndef DISPLAY_PROFILE
#define DISPLAY_PROFILE 3
#endif
#define TOY_VERSION "0.1.2"
#define TOY_DEFAULT_ROTATION (DISPLAY_PROFILE == 5 ? 1 : 0)

// Direct Arduino IDE builds select the board from the target chip. The release
// builder sets BOARD_PROFILE explicitly and rejects an incompatible target.
#ifndef BOARD_PROFILE
#if defined(CONFIG_IDF_TARGET_ESP32)
#define BOARD_PROFILE 0
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
#define BOARD_PROFILE 1
#elif defined(CONFIG_IDF_TARGET_ESP32C6)
#define BOARD_PROFILE 2
#else
#error Unsupported chip: choose ESP32, ESP32-C3 or ESP32-C6
#endif
#endif

#if BOARD_PROFILE == 0
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error ESP32 30-pin requires the ESP32 target
#endif
#define TOY_BOARD_ID "esp32-30pin"
#define TOY_BOARD_NAME "ESP32 30-pin"
#define TOY_CHIP_FAMILY "ESP32"
#define TOY_SDA 21
#define TOY_SCL 22
#define TOY_SCK 18
#define TOY_MOSI 23
#define TOY_CS 27
#define TOY_DC 26
#define TOY_RST 25
#define TOY_BUTTON 0
#elif BOARD_PROFILE == 1
#if !defined(CONFIG_IDF_TARGET_ESP32C3)
#error C3 SuperMini requires the ESP32-C3 target
#endif
#define TOY_BOARD_ID "esp32-c3-supermini"
#define TOY_BOARD_NAME "ESP32-C3 SuperMini"
#define TOY_CHIP_FAMILY "ESP32-C3"
#define TOY_SDA 4
#define TOY_SCL 5
#define TOY_SCK 6
#define TOY_MOSI 7
#define TOY_CS 10
#define TOY_DC 3
#define TOY_RST 1
#define TOY_BUTTON 9
#elif BOARD_PROFILE == 2
#if !defined(CONFIG_IDF_TARGET_ESP32C6)
#error C6 SuperMini requires the ESP32-C6 target
#endif
#define TOY_BOARD_ID "esp32-c6-supermini"
#define TOY_BOARD_NAME "ESP32-C6 SuperMini"
#define TOY_CHIP_FAMILY "ESP32-C6"
#define TOY_SDA 0
#define TOY_SCL 1
#define TOY_SCK 6
#define TOY_MOSI 7
#define TOY_CS 18
#define TOY_DC 19
#define TOY_RST 20
#define TOY_BUTTON 9
#else
#error Unknown BOARD_PROFILE
#endif
// All profiles use the onboard BOOT button, active low. Release during power-up
// or reset for normal boot; holding it then selects the ROM download mode.
// Backlight power stays on the module's specified supply; do not drive a bare
// backlight LED from a GPIO. A controlled power stage is a later hardware step.
