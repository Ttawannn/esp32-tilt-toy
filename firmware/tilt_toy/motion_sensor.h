#pragma once
#include <Arduino.h>
#include <Wire.h>

// Register layouts, ranges and startup times follow the manufacturers' data sheets:
// BMI160: https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi160-ds000.pdf
// MPU6050: https://invensense.tdk.com/products/motion-tracking/6-axis/mpu-6050/
struct MotionSample {
  float ax = 0, ay = 0, az = 0; // m/s²
  float gx = 0, gy = 0, gz = 0; // rad/s
};

class MotionSensor {
 public:
  bool begin(TwoWire &wire) {
    bus = &wire;
    kind = Kind::None;
    // BMI160 and MPU6050 share addresses, so identify before writing any registers.
    for (uint8_t candidate : {0x68, 0x69}) {
      address = candidate;
      if (matches(0x00, 0xD1)) {
        if (beginBmi160()) { kind = Kind::Bmi160; return true; }
        continue; // a known BMI160 must never receive MPU6050 commands on init failure
      }
      if (matches(0x75, 0x68) && beginMpu6050()) { kind = Kind::Mpu6050; return true; }
    }
    address = 0;
    return false;
  }

  const char *name() const {
    switch (kind) {
      case Kind::Bmi160: return "BMI160";
      case Kind::Mpu6050: return "MPU6050";
      default: return "none";
    }
  }
  uint8_t i2cAddress() const { return address; }
  // Every supported sensor is a 6-axis IMU.
  bool hasGyro() const { return kind != Kind::None; }

  bool read(MotionSample &sample) {
    uint8_t data[14];
    MotionSample next;
    const float accelScale = 9.81f / 4096.0f; // ±8 g, 16-bit BMI160 / MPU6050
    const float radians = 0.0174532925199433f;
    if (kind == Kind::Bmi160) {
      if (!readBytes(0x0C, data, 12)) return false;
      next.gx = littleEndian(data) * (radians / 65.6f);
      next.gy = littleEndian(data + 2) * (radians / 65.6f);
      next.gz = littleEndian(data + 4) * (radians / 65.6f);
      next.ax = littleEndian(data + 6) * accelScale;
      next.ay = littleEndian(data + 8) * accelScale;
      next.az = littleEndian(data + 10) * accelScale;
    } else if (kind == Kind::Mpu6050) {
      if (!readBytes(0x3B, data, 14)) return false;
      next.ax = bigEndian(data) * accelScale;
      next.ay = bigEndian(data + 2) * accelScale;
      next.az = bigEndian(data + 4) * accelScale;
      // Temperature occupies bytes 6–7; gyro at ±500°/s uses 65.5 LSB/°/s.
      next.gx = bigEndian(data + 8) * (radians / 65.5f);
      next.gy = bigEndian(data + 10) * (radians / 65.5f);
      next.gz = bigEndian(data + 12) * (radians / 65.5f);
    } else return false;
    // A short read must never publish a partially updated sample.
    sample = next;
    return true;
  }

 private:
  enum class Kind { None, Bmi160, Mpu6050 };
  Kind kind = Kind::None;
  TwoWire *bus = nullptr;
  uint8_t address = 0;

  static int16_t littleEndian(const uint8_t *data) { return (int16_t)((uint16_t)data[1] << 8 | data[0]); }
  static int16_t bigEndian(const uint8_t *data) { return (int16_t)((uint16_t)data[0] << 8 | data[1]); }
  bool writeByte(uint8_t reg, uint8_t value) {
    bus->beginTransmission(address);
    bus->write(reg); bus->write(value);
    return bus->endTransmission() == 0;
  }
  bool readBytes(uint8_t reg, uint8_t *data, uint8_t count) {
    bus->beginTransmission(address); bus->write(reg);
    if (bus->endTransmission(false) != 0) return false;
    if (bus->requestFrom(address, count) != count) {
      while (bus->available()) bus->read();
      return false;
    }
    for (uint8_t i = 0; i < count; i++) data[i] = bus->read();
    return true;
  }
  bool matches(uint8_t reg, uint8_t expected) {
    uint8_t value;
    return readBytes(reg, &value, 1) && value == expected;
  }
  bool beginBmi160() {
    if (!writeByte(0x7E, 0xB6)) return false; // soft reset
    delay(15);
    if (!writeByte(0x7E, 0x11)) return false; // accelerometer normal mode
    delay(5);
    if (!writeByte(0x7E, 0x15)) return false; // gyro normal mode (startup ≤80 ms)
    delay(100);
    if (!writeByte(0x40, 0x28) || !writeByte(0x41, 0x08) || // 100 Hz, normal filter, ±8 g
        !writeByte(0x42, 0x28) || !writeByte(0x43, 0x02)) return false; // 100 Hz, ±500°/s
    delay(20);
    return matches(0x00, 0xD1) && matches(0x03, 0x14) && matches(0x02, 0x00) &&
           matches(0x40, 0x28) && matches(0x41, 0x08) && matches(0x42, 0x28) && matches(0x43, 0x02);
  }
  bool beginMpu6050() {
    if (!writeByte(0x6B, 0x80)) return false;
    delay(100);
    if (!writeByte(0x6B, 0x01) || !writeByte(0x6C, 0x00)) return false; // PLL clock, all axes on
    delay(30);
    if (!writeByte(0x1A, 0x04) || !writeByte(0x19, 9) || // 21 Hz filter, 100 Hz sample rate
        !writeByte(0x1B, 0x08) || !writeByte(0x1C, 0x10)) return false; // ±500°/s, ±8 g
    delay(20);
    return matches(0x75, 0x68) && matches(0x6B, 0x01) && matches(0x6C, 0x00) &&
           matches(0x1A, 0x04) && matches(0x19, 9) && matches(0x1B, 0x08) && matches(0x1C, 0x10);
  }
};
