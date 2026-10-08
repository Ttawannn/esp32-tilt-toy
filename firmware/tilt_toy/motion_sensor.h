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
        if (beginBmi160()) { kind = Kind::Bmi160; if (startFifo()) return true; kind = Kind::None; }
        continue; // a known BMI160 must never receive MPU6050 commands on init failure
      }
      if (matches(0x75, 0x68) && beginMpu6050()) { kind = Kind::Mpu6050; if (startFifo()) return true; kind = Kind::None; }
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

  static constexpr uint8_t MaxBatch = 85;
  uint32_t fifoResets = 0;
  bool resetFifo() {
    if (kind == Kind::Bmi160) return writeByte(0x7E, 0xB0);
    if (kind == Kind::Mpu6050) return writeByte(0x6A, 0x04) && writeByte(0x6A, 0x40);
    return false;
  }
  // Snapshot and drain complete 100 Hz frames. Publish nothing on a failed transaction.
  // Read one complete frame per transaction: BMI160 repeats partially read frames.
  bool readBatch(MotionSample *samples, uint8_t &count) {
    count = 0;
    if (kind == Kind::None) return false;
    uint8_t size[2], status = 0;
    if (kind == Kind::Mpu6050 && !readBytes(0x3A, &status, 1)) return false;
    if (!readBytes(kind == Kind::Bmi160 ? 0x22 : 0x72, size, 2)) return false;
    uint16_t bytes = kind == Kind::Bmi160 ? ((size[1] & 7) << 8 | size[0]) : (size[0] << 8 | size[1]);
    if (bytes >= 1008 || (status & 0x10)) { fifoResets++; return resetFifo(); }
    uint8_t frames = bytes/12;
    for (uint8_t i = 0; i < frames; i++) {
      uint8_t data[12];
      if (!readBytes(kind == Kind::Bmi160 ? 0x24 : 0x74, data, 12)) {
        fifoResets++; resetFifo(); return false;
      }
      MotionSample next;
      const float accel = 9.81f/4096, gyro = 0.0174532925199433f/16.4f;
      if (kind == Kind::Bmi160) {
        next.gx = littleEndian(data)*gyro; next.gy = littleEndian(data+2)*gyro; next.gz = littleEndian(data+4)*gyro;
        next.ax = littleEndian(data+6)*accel; next.ay = littleEndian(data+8)*accel; next.az = littleEndian(data+10)*accel;
      } else {
        next.ax = bigEndian(data)*accel; next.ay = bigEndian(data+2)*accel; next.az = bigEndian(data+4)*accel;
        next.gx = bigEndian(data+6)*gyro; next.gy = bigEndian(data+8)*gyro; next.gz = bigEndian(data+10)*gyro;
      }
      samples[i] = next;
    }
    count = frames; return true;
  }

  bool read(MotionSample &sample) {
    uint8_t data[14];
    MotionSample next;
    const float accelScale = 9.81f / 4096.0f; // ±8 g, 16-bit BMI160 / MPU6050
    const float radians = 0.0174532925199433f;
    if (kind == Kind::Bmi160) {
      if (!readBytes(0x0C, data, 12)) return false;
      next.gx = littleEndian(data) * (radians / 16.4f);
      next.gy = littleEndian(data + 2) * (radians / 16.4f);
      next.gz = littleEndian(data + 4) * (radians / 16.4f);
      next.ax = littleEndian(data + 6) * accelScale;
      next.ay = littleEndian(data + 8) * accelScale;
      next.az = littleEndian(data + 10) * accelScale;
    } else if (kind == Kind::Mpu6050) {
      if (!readBytes(0x3B, data, 14)) return false;
      next.ax = bigEndian(data) * accelScale;
      next.ay = bigEndian(data + 2) * accelScale;
      next.az = bigEndian(data + 4) * accelScale;
      // Temperature occupies bytes 6–7; gyro at ±2000°/s uses 16.4 LSB/°/s.
      next.gx = bigEndian(data + 8) * (radians / 16.4f);
      next.gy = bigEndian(data + 10) * (radians / 16.4f);
      next.gz = bigEndian(data + 12) * (radians / 16.4f);
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

  bool startFifo() {
    // Equal 100 Hz ODRs permit BMI160 headerless gyro+accel frames (12 bytes).
    if (kind == Kind::Bmi160) return writeByte(0x45, 0x88) && writeByte(0x47, 0xC0) && matches(0x47, 0xC0) && resetFifo();
    return writeByte(0x23, 0x78) && matches(0x23, 0x78) && resetFifo();
  }

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
        !writeByte(0x42, 0x28) || !writeByte(0x43, 0x00)) return false; // 100 Hz, ±2000°/s
    delay(20);
    return matches(0x00, 0xD1) && matches(0x03, 0x14) && matches(0x02, 0x00) &&
           matches(0x40, 0x28) && matches(0x41, 0x08) && matches(0x42, 0x28) && matches(0x43, 0x00);
  }
  bool beginMpu6050() {
    if (!writeByte(0x6B, 0x80)) return false;
    delay(100);
    if (!writeByte(0x6B, 0x01) || !writeByte(0x6C, 0x00)) return false; // PLL clock, all axes on
    delay(30);
    if (!writeByte(0x1A, 0x04) || !writeByte(0x19, 9) || // 21 Hz filter, 100 Hz sample rate
        !writeByte(0x1B, 0x18) || !writeByte(0x1C, 0x10)) return false; // ±2000°/s, ±8 g
    delay(20);
    return matches(0x75, 0x68) && matches(0x6B, 0x01) && matches(0x6C, 0x00) &&
           matches(0x1A, 0x04) && matches(0x19, 9) && matches(0x1B, 0x18) && matches(0x1C, 0x10);
  }
};
