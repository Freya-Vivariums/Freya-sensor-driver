/*
 *  BME680 - Temperature/Humidity/Pressure/Gas sensor
 *  A TypeScript implementation for interfacing with the BME680 environmental sensor via I2C.
 * 
 *  by Sanne 'SpuQ' Santens, late 2024
 */

// BME680 Registers
const REG_CHIP_ID = 0xD0;
const REG_CTRL_HUM = 0x72;
const REG_CTRL_MEAS = 0x74;
const REG_CONFIG = 0x75;
const REG_PRESS_MSB = 0x1F;
const REG_TEMP_MSB = 0x22;
const REG_HUM_MSB = 0x25;

// Compensation parameter registers
const REG_CALIB_DATA = 0x89; // Calibration data start register

// Oversampling settings
const OSRS_H = 0x01; // Humidity oversampling x1
const OSRS_T = 0x01; // Temperature oversampling x1
const OSRS_P = 0x01; // Pressure oversampling x1

// Mode settings
const MODE_SLEEP = 0x00;
const MODE_FORCED = 0x01;

export default class BME680 {
    private i2c_address: number;
    private i2c_interface: any;

    constructor(i2c_address: number, i2c_interface: any) {
        this.i2c_address = i2c_address;
        this.i2c_interface = i2c_interface;
        this.init();
    }

    // Write a byte to a register
    private writeByte(register: number, value: number): void {
        this.i2c_interface.writeByteSync(this.i2c_address, register, value);
    }

    // Read a block of bytes
    private readBytes(register: number, length: number): Buffer {
        const buffer = Buffer.alloc(length);
        this.i2c_interface.readI2cBlockSync(this.i2c_address, register, length, buffer);
        return buffer;
    }

    // Sensor Initialization
    private init(): void {
        console.log("Initializing BME680...");
        this.writeByte(0x74, 0x25); // Force mode, default oversampling
        console.log("Initialization complete.");
    }

    // Read raw temperature ADC value
    public getRawTemperature(): number {
        const data = this.readBytes(0x22, 3); // Read temperature registers
        const adc_T = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
        console.log("Raw Temperature ADC:", adc_T);
        return adc_T;
    }

    // Read raw pressure ADC value
    public getPressure(): number {
        const data = this.readBytes(0x1F, 3); // Read pressure registers
        const adc_P = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
        console.log("Raw Pressure ADC:", adc_P);
        return adc_P;
    }

    // Read raw humidity ADC value
    public getHumidity(): number {
        const data = this.readBytes(0x25, 2); // Read humidity registers
        const adc_H = (data[0] << 8) | data[1];
        console.log("Raw Humidity ADC:", adc_H);
        return adc_H;
    }

    // Estimate temperature from raw ADC (simple approximation)
    public getTemperature(): number {
        const rawTemperature = this.getRawTemperature();

        // Simple scaling to estimate Celsius without calibration
        // Assuming a rough mapping from datasheet reference
        const temperatureC = (rawTemperature / 5120) - 25; // Adjusted for typical offset
        console.log(`Estimated Temperature: ${temperatureC.toFixed(2)}°C`);
        return temperatureC;
    }
}