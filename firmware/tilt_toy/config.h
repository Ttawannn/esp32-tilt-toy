#pragma once
#ifndef DISPLAY_PROFILE
#define DISPLAY_PROFILE 3
#endif
#define TOY_VERSION "0.1.0"
#define TOY_SDA 0
#define TOY_SCL 1
#define TOY_SCK 6
#define TOY_MOSI 7
#define TOY_CS 18
#define TOY_DC 19
#define TOY_RST 20
#define TOY_BUTTON 2
// Backlight power stays on the module's specified supply; do not drive a bare
// backlight LED from a GPIO. A controlled power stage is a later hardware step.
