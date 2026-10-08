#pragma once
#include <array>
#include <map>
#include <vector>
#include <deque>
#include <cstdint>

class TwoWire {
 public:
  std::map<uint8_t, std::array<uint8_t, 256>> devices;
  struct Write { uint8_t address, reg, value; };
  std::vector<Write> writes;
  int failWriteReg = -1;
  int ignoreWriteReg = -1;
  bool shortRead = false;
  bool shortFifoRead = false;
  std::map<uint8_t, std::deque<uint8_t>> fifo;
  void beginTransmission(uint8_t address) { target = address; sent.clear(); }
  void write(uint8_t value) { sent.push_back(value); }
  int endTransmission(bool = true) {
    if (!devices.count(target)) return 2;
    pointer = sent[0];
    if (sent.size() == 2) {
      if (pointer == failWriteReg) return 3;
      writes.push_back({target, pointer, sent[1]});
      if (pointer != ignoreWriteReg) devices[target][pointer] = sent[1];
      if (pointer == 0x7E && sent[1] == 0x11) devices[target][0x03] |= 0x10;
      if (pointer == 0x7E && sent[1] == 0x15) devices[target][0x03] |= 0x04;
      if ((pointer == 0x7E && sent[1] == 0xB0) || (pointer == 0x6A && sent[1] == 0x04)) {
        fifo[target].clear(); devices[target][0x3A] = 0;
      }
    }
    return 0;
  }
  uint8_t requestFrom(uint8_t address, uint8_t count) {
    received.clear(); index = 0;
    if (!devices.count(address)) return 0;
    const bool fifoData = pointer == 0x24 || pointer == 0x74;
    const uint8_t availableCount = shortRead || (shortFifoRead && fifoData) ? count - 1 : count;
    for (uint8_t i = 0; i < availableCount; i++) {
      const unsigned bytes = static_cast<unsigned>(fifo[address].size());
      if (fifoData) { if (fifo[address].empty()) received.push_back(0x80); else { received.push_back(fifo[address].front()); fifo[address].pop_front(); } }
      else if (pointer == 0x22) received.push_back(i ? bytes >> 8 : bytes & 0xFF);
      else if (pointer == 0x72) received.push_back(i ? bytes & 0xFF : bytes >> 8);
      else received.push_back(devices[address][pointer + i]);
    }
    return availableCount;
  }
  int available() { return static_cast<int>(received.size() - index); }
  int read() { return received[index++]; }
 private:
  uint8_t target = 0, pointer = 0;
  std::size_t index = 0;
  std::vector<uint8_t> sent, received;
};
