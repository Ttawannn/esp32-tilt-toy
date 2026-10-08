#pragma once
#include <cmath>
#include <cstdlib>
#include "motion_sensor.h"

struct MotionVector { float x = 0, y = 0, z = 0; };

// Body-to-world quaternion. The screen frame is x right, y down, z into the screen.
// Mirror equations/constants in web/motion.js; no allocation in the sample path.
class MotionState {
 public:
  static constexpr float G = 9.81f, Degrees = 57.295779513f;
  float q[4] = {1, 0, 0, 0};
  MotionVector gravity{0, 1, 0}, omega{}, linear{}, bias{};
  float roll = 0, pitch = 0, yaw = 0, omegaDot = 0, stillMs = 0;
  bool ready = false, shake = false;
  int8_t axes[3] = {1, 2, 3};
  int rotation = 0;

  static float clamp(float v, float a, float b) { return fmaxf(a, fminf(b, v)); }
  static float length(MotionVector v) { return sqrtf(v.x*v.x + v.y*v.y + v.z*v.z); }
  static bool validAxes(int x, int y, int z) {
    if (x < -3 || x > 3 || y < -3 || y > 3 || z < -3 || z > 3) return false;
    int a = abs(x), b = abs(y), c = abs(z);
    if (a < 1 || a > 3 || b < 1 || b > 3 || c < 1 || c > 3 || a == b || a == c || b == c) return false;
    // A reflection reverses angular velocity's handedness. Only proper rotations are accepted.
    int inversions = (a > b) + (a > c) + (b > c);
    return ((inversions + (x < 0) + (y < 0) + (z < 0)) % 2) == 0;
  }
  bool setAxes(int x, int y, int z, int turn = 0) {
    if (!validAxes(x, y, z) || turn < 0 || turn > 3) return false;
    axes[0] = x; axes[1] = y; axes[2] = z; rotation = turn;
    reset(); return true;
  }
  void reset() {
    q[0] = 1; q[1] = q[2] = q[3] = 0;
    ready = false; gravity = {0, 1, 0}; omega = {}; linear = {}; bias = {};
    roll = pitch = yaw = omegaDot = stillMs = 0; shake = false;
    frameSum = {}; frameCount = 0; dotSum = 0;
  }
  MotionVector map(float x, float y, float z) const {
    float source[3] = {x, y, z}, out[3];
    for (int i = 0; i < 3; i++) out[i] = source[abs(axes[i])-1] * (axes[i] < 0 ? -1 : 1);
    if (rotation == 1) return {-out[1], out[0], out[2]};
    if (rotation == 2) return {-out[0], -out[1], out[2]};
    if (rotation == 3) return {out[1], -out[0], out[2]};
    return {out[0], out[1], out[2]};
  }
  void update(const MotionSample &sample, float dt = .01f) {
    if (!std::isfinite(dt) || dt <= 0 || dt > .05f) return;
    MotionVector a = map(sample.ax, sample.ay, sample.az), w = map(sample.gx, sample.gy, sample.gz);
    if (!std::isfinite(length(a)) || !std::isfinite(length(w))) return;
    float magnitude = length(a);
    if (!ready) {
      if (magnitude < 1) return;
      // Shortest rotation from measured gravity to world +z, including the upside-down case.
      q[0] = 1 + a.z/magnitude; q[1] = a.y/magnitude; q[2] = -a.x/magnitude; q[3] = 0;
      if (q[0] < .00001f) { q[0] = 0; q[1] = 1; q[2] = 0; }
      normalize(); estimateGravity(); ready = true;
    }
    w.x -= bias.x; w.y -= bias.y; w.z -= bias.z;
    bool still = length(w) < .05f && fabsf(magnitude-G) < .3f;
    stillMs = still ? stillMs + dt*1000 : 0;
    if (stillMs > 1000) {
      float k = 1-expf(-dt*.2f);
      bias.x += w.x*k; bias.y += w.y*k; bias.z += w.z*k;
    }
    float oldOmega = omega.z, k = 1-expf(-62.831853f*dt);
    omega.x += (w.x-omega.x)*k; omega.y += (w.y-omega.y)*k; omega.z += (w.z-omega.z)*k;
    omegaDot = clamp((omega.z-oldOmega)/dt, -40, 40);
    // Mahony proportional correction; accelerometer is ignored during strong translation.
    MotionVector correction{};
    if (fabsf(magnitude-G) < 2 && magnitude > 1) {
      correction = {(a.y*gravity.z-a.z*gravity.y)/magnitude,
                    (a.z*gravity.x-a.x*gravity.z)/magnitude,
                    (a.x*gravity.y-a.y*gravity.x)/magnitude};
    }
    float wx = w.x+correction.x, wy = w.y+correction.y, wz = w.z+correction.z;
    float qw = q[0], qx = q[1], qy = q[2], qz = q[3], half = dt*.5f;
    q[0] += (-qx*wx-qy*wy-qz*wz)*half;
    q[1] += (qw*wx+qy*wz-qz*wy)*half;
    q[2] += (qw*wy-qx*wz+qz*wx)*half;
    q[3] += (qw*wz+qx*wy-qy*wx)*half;
    normalize(); estimateGravity();
    linear = {a.x-G*gravity.x, a.y-G*gravity.y, a.z-G*gravity.z};
    roll = atan2f(gravity.x, gravity.y)*Degrees;
    pitch = atan2f(gravity.z, hypotf(gravity.x, gravity.y))*Degrees;
    yaw = atan2f(2*(q[0]*q[3]+q[1]*q[2]), 1-2*(q[2]*q[2]+q[3]*q[3]))*Degrees;
    shake = fabsf(magnitude-G) > 7 || fabsf(w.x)+fabsf(w.y)+fabsf(w.z) > 5;
    frameSum.x += linear.x; frameSum.y += linear.y; frameSum.z += linear.z;
    dotSum += omegaDot; frameCount++;
  }
  MotionVector consumeFrame(float &angularAcceleration) {
    MotionVector result = linear;
    angularAcceleration = 0;
    if (frameCount) {
      result = {frameSum.x/frameCount, frameSum.y/frameCount, frameSum.z/frameCount};
      angularAcceleration = dotSum/frameCount;
    }
    frameSum = {}; frameCount = 0; dotSum = 0; return result;
  }
 private:
  MotionVector frameSum{};
  unsigned frameCount = 0;
  float dotSum = 0;
  void normalize() {
    float n = sqrtf(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]);
    for (float &value : q) value /= n;
  }
  void estimateGravity() {
    gravity = {2*(q[1]*q[3]-q[0]*q[2]), 2*(q[0]*q[1]+q[2]*q[3]),
               1-2*(q[1]*q[1]+q[2]*q[2])};
  }
};
