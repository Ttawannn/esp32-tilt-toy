#include <cassert>
#include <cmath>
#include <cstring>
#include <iostream>
#include "../../firmware/tilt_toy/motion_sensor.h"

void closeTo(float actual, float expected, float tolerance = 0.001f) {
  assert(std::fabs(actual - expected) < tolerance);
}
void put(TwoWire &wire, uint8_t address, uint8_t reg, int16_t value, bool bigEndian = false) {
  const uint16_t bits = static_cast<uint16_t>(value);
  wire.devices[address][reg] = bigEndian ? bits >> 8 : bits & 0xFF;
  wire.devices[address][reg + 1] = bigEndian ? bits & 0xFF : bits >> 8;
}
int main() {
  for (uint8_t address : {0x68, 0x69}) {
    TwoWire wire;
    wire.devices[address][0x00] = 0xD1;
    MotionSensor sensor;
    assert(sensor.begin(wire));
    assert(!std::strcmp(sensor.name(), "BMI160") && sensor.hasGyro());
    assert(sensor.i2cAddress() == address);
    put(wire, address, 0x0C, 6560); put(wire, address, 0x0E, -6560); put(wire, address, 0x10, 0);
    put(wire, address, 0x12, 4096); put(wire, address, 0x14, -4096); put(wire, address, 0x16, 8192);
    MotionSample sample;
    assert(sensor.read(sample));
    closeTo(sample.ax, 9.81f); closeTo(sample.ay, -9.81f); closeTo(sample.az, 19.62f);
    closeTo(sample.gx, 1.745329f); closeTo(sample.gy, -1.745329f); closeTo(sample.gz, 0);
    for (auto write : wire.writes) assert(write.reg != 0x6B); // no MPU6050 reset on BMI160
  }
  for (uint8_t address : {0x68, 0x69}) {
    TwoWire wire;
    wire.devices[address][0x75] = 0x68; // WHO_AM_I stays 0x68 with AD0 high
    MotionSensor sensor;
    assert(sensor.begin(wire));
    assert(!std::strcmp(sensor.name(), "MPU6050") && sensor.hasGyro());
    assert(sensor.i2cAddress() == address);
    put(wire, address, 0x3B, -4096, true); put(wire, address, 0x3D, 4096, true); put(wire, address, 0x3F, -32768, true);
    put(wire, address, 0x41, 12345, true); // temperature must not be treated as gyro
    put(wire, address, 0x43, 6550, true); put(wire, address, 0x45, -6550, true); put(wire, address, 0x47, 0, true);
    MotionSample sample;
    assert(sensor.read(sample));
    closeTo(sample.ax, -9.81f); closeTo(sample.ay, 9.81f); closeTo(sample.az, -78.48f);
    closeTo(sample.gx, 1.745329f); closeTo(sample.gy, -1.745329f); closeTo(sample.gz, 0);
    for (auto write : wire.writes) assert(write.reg != 0x7E); // no BMI160 commands on MPU6050
  }
  {
    TwoWire wire;
    wire.devices[0x68][0x75] = 0x68;
    MotionSensor sensor;
    assert(sensor.begin(wire));
    MotionSample sample;
    assert(sensor.read(sample));
    wire.shortRead = true;
    sample.ax = 42; sample.gx = 43;
    assert(!sensor.read(sample));
    closeTo(sample.ax, 42); closeTo(sample.gx, 43);
    assert(wire.available() == 0);
    wire.shortRead = false;
    wire.devices.clear();
    assert(!sensor.read(sample)); // disconnected device
    closeTo(sample.ax, 42);
  }
  {
    TwoWire wire;
    wire.devices[0x68][0x00] = 0x42; // unrelated I²C device
    wire.devices[0x53][0x00] = 0xE5; // unsupported accelerometer must not be selected or configured
    MotionSensor sensor;
    assert(!sensor.begin(wire) && wire.writes.empty());
    assert(!std::strcmp(sensor.name(), "none") && !sensor.hasGyro() && sensor.i2cAddress() == 0);
    MotionSample sample; sample.ax = 42;
    assert(!sensor.read(sample)); closeTo(sample.ax, 42);
  }
  for (bool acknowledgeButIgnore : {false, true}) {
    TwoWire wire;
    wire.devices[0x68][0x00] = 0xD1;
    wire.devices[0x68][0x75] = 0x68; // BMI160 offset bytes may resemble MPU6050 WHO_AM_I
    if (acknowledgeButIgnore) wire.ignoreWriteReg = 0x41;
    else wire.failWriteReg = 0x41;
    MotionSensor sensor;
    assert(!sensor.begin(wire)); // failed or ineffective range writes cannot claim a working sensor
    for (auto write : wire.writes) assert(write.reg != 0x6B);
    wire.devices[0x69][0x75] = 0x68;
    assert(sensor.begin(wire)); // another supported device remains usable
    assert(!std::strcmp(sensor.name(), "MPU6050") && sensor.i2cAddress() == 0x69);
  }
  std::cout << "Motion sensor detection, units, signed data and I2C failures passed\n";
}
