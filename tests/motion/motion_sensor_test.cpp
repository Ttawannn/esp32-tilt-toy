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
    put(wire, address, 0x0C, 1640); put(wire, address, 0x0E, -1640); put(wire, address, 0x10, 0);
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
    put(wire, address, 0x43, 1640, true); put(wire, address, 0x45, -1640, true); put(wire, address, 0x47, 0, true);
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
  for (bool bmi : {false, true}) {
    TwoWire wire;
    uint8_t address = 0x68;
    wire.devices[address][bmi ? 0x00 : 0x75] = bmi ? 0xD1 : 0x68;
    MotionSensor sensor;
    assert(sensor.begin(wire));
    assert(wire.devices[address][bmi ? 0x43 : 0x1B] == (bmi ? 0 : 0x18));
    assert(wire.devices[address][bmi ? 0x47 : 0x23] == (bmi ? 0xC0 : 0x78));
    MotionSample samples[MotionSensor::MaxBatch]; uint8_t count = 99;
    assert(sensor.readBatch(samples,count) && count == 0);
    auto enqueue = [&](int16_t ax, int16_t gz) {
      int16_t values[6] = {ax,0,4096,0,0,gz};
      if (bmi) { values[0]=0;values[1]=0;values[2]=gz;values[3]=ax;values[4]=0;values[5]=4096; }
      for (int16_t value : values) {
        uint16_t bits = static_cast<uint16_t>(value);
        wire.fifo[address].push_back(bmi ? bits & 0xff : bits >> 8);
        wire.fifo[address].push_back(bmi ? bits >> 8 : bits & 0xff);
      }
    };
    enqueue(4096,1640); enqueue(-4096,-1640); enqueue(0,32767);
    assert(sensor.readBatch(samples,count) && count == 3);
    closeTo(samples[0].ax,9.81f);closeTo(samples[0].az,9.81f);closeTo(samples[0].gz,1.745329f);
    closeTo(samples[1].ax,-9.81f);closeTo(samples[1].gz,-1.745329f);
    closeTo(samples[2].gz,34.87036f,.002f); assert(wire.fifo[address].empty());
    enqueue(0,0);wire.shortFifoRead=true;
    assert(!sensor.readBatch(samples,count) && count == 0 && wire.fifo[address].empty());
    wire.shortFifoRead=false;
    for (int i=0;i<85;i++) enqueue(0,0);
    assert(sensor.readBatch(samples,count) && count == 0 && sensor.fifoResets == 2);
    assert(wire.fifo[address].empty());
    enqueue(4096,0); assert(sensor.readBatch(samples,count) && count == 1);
    // An incomplete packet stays queued until its final bytes arrive.
    enqueue(0,0); auto last=wire.fifo[address].back();wire.fifo[address].pop_back();
    assert(sensor.readBatch(samples,count) && count == 0 && wire.fifo[address].size() == 11);
    wire.fifo[address].push_back(last);assert(sensor.readBatch(samples,count) && count == 1);
    if (!bmi) { enqueue(0,0);wire.devices[address][0x3A]=0x10;assert(sensor.readBatch(samples,count) && count == 0); }
    wire.devices.clear();assert(!sensor.readBatch(samples,count) && count == 0);
  }
  std::cout << "Motion sensor detection, units, signed data, FIFO and I2C failures passed\n";
}
