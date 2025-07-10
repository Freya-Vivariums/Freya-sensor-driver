/*
 *  VEML6030 - Ambient Light sensor
 *  A TypeScript implementation for interfacing with the VEML6030 ambient light sensor via I2C.
 * 
 *  by Sanne "SpuQ" Santens, late 2024
 */

import { openPromisified, PromisifiedBus } from 'i2c-bus';

/**
 * VEML6030 ambient light sensor driver for Raspberry Pi (Node.js).
 *
 * Measures ambient light intensity in lux via I²C, following Vishay VEML6030 datasheet (Doc. R101048).
 * Supports configurable gain and integration time, plus >1klux compensation polynomial.
 */
export default class VEML6030 {
  private i2c!: PromisifiedBus;
  private address: number;

  private busNumber: number = 1;
  /**
   * Current ALS gain factor (e.g. 2, 1, 1/4, 1/8).
   * Used in lux conversion formula.
   */
  private gainValue!: number;

  /**
   * Integration time in milliseconds (25, 50, 100, 200, 400, 800).
   */
  private integrationTime!: number;

  /**
   * Scale factor: lux per raw count based on gain & integration time.
   */
  private luxPerCount!: number;

  /**
   * Create a new VEML6030 instance.
   * @param busNumber - I2C bus number (default 1).
   * @param address - 7-bit I2C address (0x48 default, 0x10 if ADDR pin low).
   */
  constructor( address:number) {

    this.address = address;
  }

  /**
   * Initialize sensor: open I2C bus, verify device ID, configure ALS settings.
   * @param gainBits - 2-bit code for ALS gain (00=2×, 01=1×, 11=1/4×, 10=1/8×).
   * @param itBits - 3-bit code for integration time (000=100ms,001=200ms,010=400ms,011=800ms,100=50ms,101=25ms).
   * @throws if device ID mismatch.
   */
  public async init(
    gainBits: number = 0b11,
    itBits: number = 0b000
  ): Promise<void> {
    // Open I2C bus
    this.i2c = await openPromisified(this.busNumber);

    // Read device ID (reg 0x07 LSB should be 0x81) (§3.2)
    const id = await this.i2c.readWord(this.address, 0x07);
    const idLsb = id & 0xFF;
    if (idLsb !== 0x81) {
      throw new Error(`VEML6030 not found at 0x${this.address.toString(16)}`);
    }

    // Store gain & IT values
    this.gainValue = this.decodeGain(gainBits);
    this.integrationTime = this.decodeIntegrationTime(itBits);

    // Compute lux per count: base 0.0036lx/count at 800ms,2× (§AppNote)
    const base = 0.0036;
    this.luxPerCount =
      base * (800 / this.integrationTime) * (2 / this.gainValue);

    // Build 16-bit config: [15..13]=0, [12..11]=gainBits, [10]=INT disable (0),
    // [9..7]=itBits, [6]=0, [5]=interrupt persist (0), [4]=0, [2]=shutdown(0)
    const cfg = (gainBits << 11) | (itBits << 7);
    await this.i2c.writeWord(this.address, 0x00, cfg);

    // Delay one integration cycle before first read (§IT timing)
    await this.delay(this.integrationTime + 10);
  }

  /**
   * Read ambient light and return lux value.
   * @returns Object with `lux` (floating-point).
   */
  public async read(): Promise<{ lux: number }> {
    // Read raw ALS data (reg 0x04 LSB then MSB) (§3.8)
    const raw = await this.i2c.readWord(this.address, 0x04);
    const counts = raw & 0xFFFF;

    // Convert to lux
    let lux = counts * this.luxPerCount;

    // Apply high-lux compensation if gain <=1/4 and lux >1000 (§AppNote)
    if (this.gainValue <= 0.25 && lux > 1000) {
      lux = this.compensateHighLux(lux);
    }

    return { lux };
  }

  /**
   * Decode gain code to factor.
   * @param bits - 2-bit gain code.
   */
  private decodeGain(bits: number): number {
    switch (bits & 0b11) {
      case 0b00:
        return 2;
      case 0b01:
        return 1;
      case 0b11:
        return 0.25;
      case 0b10:
        return 0.125;
      default:
        return 1;
    }
  }

  /**
   * Decode integration time code to milliseconds.
   * @param bits - 3-bit integration time code.
   */
  private decodeIntegrationTime(bits: number): number {
    switch (bits & 0b111) {
      case 0b000:
        return 100;
      case 0b001:
        return 200;
      case 0b010:
        return 400;
      case 0b011:
        return 800;
      case 0b100:
        return 50;
      case 0b101:
        return 25;
      default:
        return 100;
    }
  }

  /**
   * Non-linear compensation (>1klux) polynomial (§AppNote).
   * lux_comp = A·lux^4 + B·lux^3 + C·lux^2 + D·lux
   */
  private compensateHighLux(lux: number): number {
    // Coefficients from Vishay app note
    const A = 6.0135e-13;
    const B = -9.3924e-9;
    const C = 8.1488e-5;
    const D = 1.0023;
    return A * Math.pow(lux, 4)
      + B * Math.pow(lux, 3)
      + C * Math.pow(lux, 2)
      + D * lux;
  }

  /**
   * Simple delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
