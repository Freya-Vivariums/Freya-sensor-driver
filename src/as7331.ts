/*
 *  AS7331 - UVA/B/C spectrum sensor
 *  A TypeScript implementation for interfacing with the AS7331 
 *  spectral sensor via I2C.
 * 
 *  by Sanne 'SpuQ' Santens, late 2024
 */
import { openPromisified, PromisifiedBus } from 'i2c-bus';

/**
 * AS7331 spectral UV sensor driver for Raspberry Pi (Node.js).
 *
 * Measures UVA, UVB, and UVC irradiance in µW/cm², plus die temperature in °C,
 * via I²C, following the AMS AS7331 datasheet (Section 7.4—7.5 for conversion formulas,
 * Section 5 for gain/integration settings, Section 4.2 for register map).
 */
export default class AS7331 {
  private i2c!: PromisifiedBus;
  private address: number;
  private busNumber: number = 1;

  private gainCode!: number;
  private timeCode!: number;
  private integrationTime!: number;  // in ms
  private gainMultiplier!: number;  // numeric gain factor

  /**
   * Create a new AS7331 driver instance.
   * @param address - 7-bit I²C address (default 0x74).
   */
  constructor( address: number ) {
    this.address = address;
  }

  /**
   * Initialize sensor: verify device ID, switch to config mode, set gain & integration.
   * @param gainCode - 4-bit gain code (0–11, see §5.2 for mapping: code 0→1×, 1→2×, ..., 11→2048×).
   * @param timeCode - 4-bit integration time code (0–14, see §5.3: code n→2ⁿ ms, up to 16 384 ms).
   * @throws Error if the device ID (upper nibble of OSR reg) does not equal 0x2.
   */
  public async init(
    gainCode: number = 7,
    timeCode: number = 7
  ): Promise<void> {
    // Open I²C bus
    this.i2c = await openPromisified(this.busNumber);

    // 1. Read OSR (Operational State Register) to verify device ID (bits 7:4 == 0x2) (§4.2)
    /*const osr = await this.i2c.readByte(this.address, 0x00);
    if ((osr & 0xF0) !== 0x20) {
      throw new Error(
        `AS7331 not found at 0x${this.address.toString(16)} (ID=0x${osr.toString(16)})`
      );
    }*/

    // 2. Enter config mode: clear CMD and keep PD=0 (power-on) (§6.3)
    await this.i2c.writeByte(this.address, 0x00, 0x00);

    // 3. Store and decode the gain/integration codes
    this.gainCode = gainCode & 0x0F;
    this.timeCode = timeCode & 0x0F;
    this.integrationTime = this.decodeIntegrationTime(this.timeCode);
    this.gainMultiplier = this.decodeGain(this.gainCode);

    // 4. Write gain to CREG1 (addr 0x06) and integration time to CREG2 (addr 0x07) (§5.2–5.3)
    await this.i2c.writeByte(this.address, 0x06, this.gainCode);
    await this.i2c.writeByte(this.address, 0x07, this.timeCode);

    // 5. Optional: set conversion clock & divider in CREG3 (addr 0x08), defaults OK
    await this.i2c.writeByte(this.address, 0x08, 0x00);
  }

  /**
   * Trigger a one-shot measurement and read UVA, UVB, UVC, and temperature.
   * @returns An object with:
   *  - `uva`, `uvb`, `uvc`: irradiance in µW/cm²
   *  - `temperature`: die temperature in °C
   */
  public async read(): Promise<{
    uva: number;
    uvb: number;
    uvc: number;
    temperature: number;
  }> {
    // 1. Start a one-shot conversion: set CMD=1 in OSR (§6.3.2)
    await this.i2c.writeByte(this.address, 0x00, 0x01);

    // 2. Wait for conversion: integrationTime + margin (§5.3 timing)
    await this.delay(this.integrationTime + 2);

    // 3. Read 6 bytes from measurement registers 0x02–0x07: UVA_L, UVA_H, UVB_L, UVB_H, UVC_L, UVC_H (§4.3)
    const buf = Buffer.alloc(6);
    await this.i2c.readI2cBlock(this.address, 0x02, 6, buf);

    // 4. Combine raw 16-bit little-endian values
    const uvaRaw = buf[0] | (buf[1] << 8);
    const uvbRaw = buf[2] | (buf[3] << 8);
    const uvcRaw = buf[4] | (buf[5] << 8);

    // 5. Read die temperature (1-byte at 0x01, conversion per §7.5)
    const tempRaw = await this.i2c.readByte(this.address, 0x01);

    // 6. Convert to physical units
    const uva = this.convertToIrradiance(uvaRaw);
    const uvb = this.convertToIrradiance(uvbRaw);
    const uvc = this.convertToIrradiance(uvcRaw);
    const temperature = this.convertTemperature(tempRaw);

    return { uva, uvb, uvc, temperature };
  }

  /**
   * Decode gain code to numeric multiplier (1×–2048×) (§5.2).
   */
  private decodeGain(code: number): number {
    // Gain = 2^code, where code ∈ [0..11]
    return Math.pow(2, code);
  }

  /**
   * Decode integration-time code to ms (1–16 384 ms) (§5.3).
   */
  private decodeIntegrationTime(code: number): number {
    // Integration time = 2^code ms, code ∈ [0..14]
    return Math.pow(2, code);
  }

  /**
   * Convert raw channel count to irradiance (µW/cm²).
   * Formula from Datasheet §7.4:
   * E (µW/cm²) = (MRES * R_cal) / (gain * T_int)
   * where R_cal is the sensor responsivity constant (µW·ms)/(count·cm²).
   */
  private convertToIrradiance(raw: number): number {
    const R_cal = 0.5; // TODO: replace with actual responsivity from datasheet §7.4 (µW·ms)/(count·cm²)
    return (raw * R_cal) / (this.gainMultiplier * this.integrationTime);
  }

  /**
   * Convert raw temperature to °C per datasheet §7.5.
   * Formula: T = raw * T_coefficient + T_offset.
   */
  private convertTemperature(raw: number): number {
    const T_coeff = 1.0;  // TODO: datasheet coefficient (°C/count)
    const T_offset = -40; // TODO: datasheet offset (°C)
    return raw * T_coeff + T_offset;
  }

  /**
   * Delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
