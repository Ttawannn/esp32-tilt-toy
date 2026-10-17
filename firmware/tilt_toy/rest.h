#pragma once
#include <math.h>
#include <stdint.h>
#include "motion_state.h"

// Decides when the toy rests and when it wakes, from the fused motion state.
// Still: the measured gravity stays within about 4° of where it settled and nothing shakes or turns it.
// Resting, it wakes when tilted more than about 12°, turned faster than about 70°/s, or shaken.
class RestTimer {
 public:
  enum Event { None = 0, Rest, Wake };
  static constexpr float StillCos = .99756f, WakeCos = .97815f, WakeSpin = 1.2f;
  uint32_t afterMs = 120000;  // 0 never rests
  bool resting = false;

  // Starts the still timer again, for a button press, a phone setting or anything else that means someone is playing.
  void touch(uint32_t now, MotionVector gravity) { ref = unit(gravity); since = now; }
  uint32_t stillFor(uint32_t now) const { return resting ? 0 : now - since; }
  // Call after each motion update. Rest fires once when the toy has been still for afterMs; Wake fires once when it moves.
  Event update(uint32_t now, MotionVector gravity, MotionVector omega, bool shake) {
    const MotionVector g = unit(gravity);
    const float along = g.x*ref.x + g.y*ref.y + g.z*ref.z;
    const bool turned = MotionState::length(omega) > WakeSpin;
    if (resting) {
      if (!shake && !turned && along >= WakeCos) return None;
      resting = false; ref = g; since = now;
      return Wake;
    }
    if (shake || turned || along < StillCos) { ref = g; since = now; return None; }
    if (!afterMs || now - since < afterMs) return None;
    resting = true;
    return Rest;
  }

 private:
  MotionVector ref{0, 1, 0};
  uint32_t since = 0;
  static MotionVector unit(MotionVector v) {
    const float length = MotionState::length(v);
    return length > 1e-6f ? MotionVector{v.x/length, v.y/length, v.z/length} : MotionVector{0, 1, 0};
  }
};
