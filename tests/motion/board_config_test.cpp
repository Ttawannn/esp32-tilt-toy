#include <iostream>
#include "../../firmware/tilt_toy/config.h"

int main() {
  std::cout << TOY_BOARD_ID << '\n' << TOY_CHIP_FAMILY << '\n'
            << BOARD_PROFILE << '\n' << TOY_SDA << '\n' << TOY_SCL << '\n'
            << TOY_SCK << '\n' << TOY_MOSI << '\n' << TOY_CS << '\n'
            << TOY_DC << '\n' << TOY_RST << '\n' << TOY_BUTTON << '\n';
}
