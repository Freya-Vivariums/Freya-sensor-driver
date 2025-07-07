/*
 *  BME680 - Temperature/Humidity/Pressure/Gas sensor
 *  A TypeScript implementation for interfacing with the BME680 environmental sensor via I2C.
 * 
 *  by Sanne 'SpuQ' Santens, mid 2025
 */
import i2c from 'i2c-bus';

// BME680 Registers
const REG_CHIP_ID       = 0xD0;
const REG_CTRL_HUM      = 0x72;
const REG_CTRL_MEAS     = 0x74;
const REG_CONFIG        = 0x75;
const REG_CALIB_START   = 0x89;
const CALIB_DATA_LEN    = 25;
const REG_HUM_CALIB     = 0xE1;
const REG_PRESS_MSB     = 0x1F;
const REG_TEMP_MSB      = 0x22;
const REG_HUM_MSB       = 0x25;
const REG_GAS_R_MSB     = 0x2C;
const REG_GAS_R_LSB     = 0x2D;

// Oversampling and mode
const OSRS_H = 0x01, OSRS_T = 0x01, OSRS_P = 0x01;
const MODE_SLEEP = 0x00, MODE_FORCED = 0x01;

export default class BME680 {
  private addr: number;
  private bus: i2c.I2CBus;
  private calib!: Record<string, number>;
  private tFine = 0;

  constructor(i2c_address: number, i2c_interface: i2c.I2CBus) {
    this.addr = i2c_address;
    this.bus  = i2c_interface;
    this.init();
  }

  /** Initialize sensor synchronously */
  private init(): void {
    const id = this.bus.readByteSync(this.addr, REG_CHIP_ID);
    if (id !== 0x61) {
      throw new Error(`BME680 not found, chip ID=0x${id.toString(16)}`);
    }

    // Read calibration blocks
    const buf = Buffer.alloc(CALIB_DATA_LEN);
    this.bus.readI2cBlockSync(this.addr, REG_CALIB_START, CALIB_DATA_LEN, buf);
    const hbuf = Buffer.alloc(7);
    this.bus.readI2cBlockSync(this.addr, REG_HUM_CALIB, 7, hbuf);

    // Parse calibration
    this.calib = {
      // Temperature
      dig_T1: buf.readUInt16LE(0),
      dig_T2: buf.readInt16LE(2),
      dig_T3: buf.readInt16LE(4),
      // Pressure
      dig_P1: buf.readUInt16LE(6),
      dig_P2: buf.readInt16LE(8),
      dig_P3: buf.readInt16LE(10),
      dig_P4: buf.readInt16LE(12),
      dig_P5: buf.readInt16LE(14),
      dig_P6: buf.readInt16LE(16),
      dig_P7: buf.readInt16LE(18),
      dig_P8: buf.readInt16LE(20),
      dig_P9: buf.readInt16LE(22),
      dig_H1: buf.readUInt8(24),
      // Humidity
      dig_H2: hbuf.readInt16LE(0),
      dig_H3: hbuf.readUInt8(2),
      dig_H4: (hbuf.readUInt8(3) << 4) | (hbuf.readUInt8(4) & 0xF),
      dig_H5: (hbuf.readUInt8(5) << 4) | (hbuf.readUInt8(4) >> 4),
      dig_H6: hbuf.readInt8(6)
    };

    // Configure oversampling synchronously
    this.bus.writeByteSync(this.addr, REG_CTRL_HUM, OSRS_H);
    const ctrl = (OSRS_T << 5) | (OSRS_P << 2) | MODE_FORCED;
    this.bus.writeByteSync(this.addr, REG_CTRL_MEAS, ctrl);
    this.bus.writeByteSync(this.addr, REG_CONFIG, 0x00);
  }

  /** Read raw ADC value synchronously */
  private readRaw(reg: number): number {
    const len = (reg === REG_HUM_MSB) ? 2 : 3;
    const buf = Buffer.alloc(len);
    this.bus.readI2cBlockSync(this.addr, reg, len, buf);
    return len === 3
      ? (buf[0] << 12) | (buf[1] << 4) | (buf[2] >> 4)
      : (buf[0] << 8) | buf[1];
  }

  /** Delay helper (blocking) */
  private sleep(ms: number): void {
    const end = Date.now() + ms;
    while (Date.now() < end) {} // busy-wait
  }

  /** Get temperature in °C */
  public getTemperature(): number {
    // trigger measurement
    const ctrl = (OSRS_T << 5) | (OSRS_P << 2) | MODE_FORCED;
    this.bus.writeByteSync(this.addr, REG_CTRL_MEAS, ctrl);
    this.sleep(12);

    const adc = this.readRaw(REG_TEMP_MSB);
    const var1 = (adc / 16384.0 - this.calib.dig_T1 / 1024.0) * this.calib.dig_T2;
    const var2 = ((adc / 131072.0 - this.calib.dig_T1 / 8192.0) ** 2) * this.calib.dig_T3;
    this.tFine = var1 + var2;
    return parseFloat((this.tFine / 5120.0).toFixed(2));
  }

  /** Get humidity in % */
  public getHumidity(): number {
    // reuse tFine from last temp measurement
    const raw = this.readRaw(REG_HUM_MSB);
    let var1 = this.tFine - 76800;
    var1 = (raw - (this.calib.dig_H4 * 64 + (this.calib.dig_H5 / 16384) * var1)) *
           (this.calib.dig_H2 / 65536 * (1 + (this.calib.dig_H6 / 67108864) * var1 *
           (1 + (this.calib.dig_H3 / 67108864) * var1)));
    var1 = var1 * (1 - this.calib.dig_H1 * var1 / 524288);
    return parseFloat(((var1 > 100 ? 100 : (var1 < 0 ? 0 : var1))).toFixed(2));
  }

  /** Get pressure in hPa */
  public getPressure(): number {
    const raw = this.readRaw(REG_PRESS_MSB);
    let var1 = this.tFine / 2 - 64000;
    let var2 = var1 * var1 * this.calib.dig_P6 / 32768;
    var2 = var2 + var1 * this.calib.dig_P5 * 2;
    var2 = var2 / 4 + this.calib.dig_P4 * 65536;
    var1 = (this.calib.dig_P3 * var1 * var1 / 524288 + this.calib.dig_P2 * var1) / 524288;
    var1 = (1 + var1 / 32768) * this.calib.dig_P1;
    if (var1 === 0) return 0;
    let p = 1048576 - raw;
    p = ((p - var2 / 4096) * 6250) / var1;
    var1 = this.calib.dig_P9 * p * p / 2147483648;
    var2 = p * this.calib.dig_P8 / 32768;
    p = p + (var1 + var2 + this.calib.dig_P7) / 16;
    return parseFloat((p / 100).toFixed(2));
  }

  /** Get gas resistance in Ω */
  public getGasResistance(): number {
    const msb = this.bus.readByteSync(this.addr, REG_GAS_R_MSB);
    const lsb = this.bus.readByteSync(this.addr, REG_GAS_R_LSB);
    return ((msb << 2) | (lsb >> 6));
  }
}
