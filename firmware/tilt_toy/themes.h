#pragma once
#include <stdint.h>

// Colour themes for the water, Pixel Flow and the robot eyes; web/themes.js holds the same colours.
// shades follow the Pixel Flow palette: 0 unused, 1 surface, 2 spray, 3-6 body from just below the
// surface to deep. Two-tone water uses body and top. Ocean is the original blue.
enum ToyTheme { ThemeOcean = 0, ThemeLava, ThemeSlime, ThemeGrape, ThemeCandy, ThemeAurora, ThemeCount };
static const char *const themeIds[ThemeCount] = {"ocean", "lava", "slime", "grape", "candy", "aurora"};
struct ThemeColors { uint8_t shades[7][3], body[3], top[3], eye[3]; };
static const ThemeColors themes[ThemeCount] = {
  {{{0,0,0},{142,232,255},{200,244,255},{43,184,240},{26,159,224},{18,136,204},{12,112,180}}, {31,162,224}, {158,230,251}, {60,220,255}},
  {{{0,0,0},{255,214,110},{255,240,190},{255,150,50},{240,100,35},{205,60,30},{150,30,30}}, {240,100,35}, {255,200,90}, {255,150,50}},
  {{{0,0,0},{200,255,150},{232,255,205},{120,230,80},{75,200,70},{45,160,65},{25,120,60}}, {75,200,70}, {190,255,140}, {140,255,100}},
  {{{0,0,0},{225,200,255},{242,230,255},{175,130,255},{145,95,240},{115,65,210},{85,45,170}}, {145,95,240}, {215,185,255}, {190,145,255}},
  {{{0,0,0},{255,205,232},{255,232,245},{255,130,195},{240,95,170},{210,65,150},{165,45,130}}, {240,95,170}, {255,190,225}, {255,125,200}},
  {{{0,0,0},{190,255,235},{230,255,248},{70,230,190},{50,175,230},{110,115,240},{165,75,220}}, {50,175,230}, {150,250,220}, {80,240,200}},
};
