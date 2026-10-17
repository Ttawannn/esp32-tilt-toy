#include <cassert>
#include <cmath>
#include "rest.h"

int main() {
  const MotionVector none{};
  const auto tilted = [](float radians) { return MotionVector{sinf(radians), 0, cosf(radians)}; };
  RestTimer rest; rest.afterMs = 60000;
  rest.touch(0, tilted(0));
  // About 2° of sensor noise does not restart the timer: it rests once, a minute after it was laid down.
  uint32_t t = 0; int rests = 0;
  for (; t <= 61000; t += 10) {
    const RestTimer::Event event = rest.update(t, tilted(.035f * sinf(t * .01f)), none, false);
    if (event == RestTimer::Rest) { rests++; assert(t >= 60000 && t < 60100); }
  }
  assert(rests == 1 && rest.resting && rest.stillFor(t) == 0);
  // Resting: an 8° nudge does not wake it, 15° does, once.
  assert(rest.update(t, tilted(.14f), none, false) == RestTimer::None);
  assert(rest.update(t, tilted(.26f), none, false) == RestTimer::Wake);
  assert(!rest.resting && rest.update(t + 10, tilted(.26f), none, false) == RestTimer::None);
  // A 6° tilt, a turn or a shake restarts the still timer.
  t += 50000; assert(rest.update(t, tilted(.26f), none, false) == RestTimer::None && rest.stillFor(t) >= 50000);
  assert(rest.update(t, tilted(.26f + .105f), none, false) == RestTimer::None && rest.stillFor(t) == 0);
  t += 30000; assert(rest.update(t, tilted(.365f), {0, 0, 1.5f}, false) == RestTimer::None && rest.stillFor(t) == 0);
  t += 30000; assert(rest.update(t, tilted(.365f), none, true) == RestTimer::None && rest.stillFor(t) == 0);
  // A turn or a shake wakes a resting toy.
  t += 60000; assert(rest.update(t, tilted(.365f), none, false) == RestTimer::Rest);
  assert(rest.update(t + 10, tilted(.365f), {0, 0, 1.5f}, false) == RestTimer::Wake);
  t += 60010; assert(rest.update(t, tilted(.365f), none, false) == RestTimer::Rest);
  assert(rest.update(t + 10, tilted(.365f), none, true) == RestTimer::Wake);
  // touch() counts as play; afterMs 0 never rests.
  t += 59000; rest.touch(t, tilted(.365f)); t += 59000;
  assert(rest.update(t, tilted(.365f), none, false) == RestTimer::None);
  rest.afterMs = 0; t += 600000;
  assert(rest.update(t, tilted(.365f), none, false) == RestTimer::None && !rest.resting);
  return 0;
}
