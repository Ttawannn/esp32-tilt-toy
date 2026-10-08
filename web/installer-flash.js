import { Transport, ESPLoader } from 'esptool-js';
import { createFlasher } from './flash-progress.js';

export const flash = createFlasher({ Transport, ESPLoader });
