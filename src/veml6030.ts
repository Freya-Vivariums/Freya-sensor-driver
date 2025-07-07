/*
 *  VEML6030 - Ambient Light sensor
 *  A TypeScript implementation for interfacing with the VEML6030 ambient light sensor via I2C.
 * 
 *  by Sanne "SpuQ" Santens, late 2024
 */

// Register addresses
const VEML6030_REG_ALS_CONF = 0x00;     // Configuration register
const VEML6030_REG_ALS = 0x04;          // ALS (ambient light sensor) data register
const VEML6030_REG_POWER_SAVE = 0x03;   // Power-saving register

export default class VEML6030 {
    private i2c_address:number|null = null;
    private i2c_interface:any|null = null;

    constructor( i2c_address:number, i2c_interface:any){
        this.i2c_address=i2c_address;
        this.i2c_interface=i2c_interface;

        // Initialize the sensor
        this.init();
    }

    // Function to write a 16-bit value to the VEML6030
    private writeWord(register: number, value: number): void {
        const buffer = Buffer.from([value & 0xff, (value >> 8) & 0xff]);
        this.i2c_interface.writeI2cBlockSync(this.i2c_address, register, 2, buffer);
    }
  
    // Function to read a 16-bit value from the VEML6030
    private readWord(register: number): number {
        const buffer = Buffer.alloc(2);
        this.i2c_interface.readI2cBlockSync(this.i2c_address, register, 2, buffer);
        return buffer[0] | (buffer[1] << 8);
    }

    // Initialize the sensor
    private init(): void {
        try{
            // Configure ALS integration time, gain, and mode
            // Example: ALS gain 1x, integration time 100ms, power-on mode
            const alsConfig = 0x0000;                           // Replace with actual configuration based on your needs
            this.writeWord(VEML6030_REG_ALS_CONF, alsConfig);

            // Configure power-saving mode (refer to datasheet)
            this.writeWord(VEML6030_REG_POWER_SAVE, 0x0000);    // Power-saving disabled
        }
        catch(e){
            console.error("Failed to initialize VEML6030: "+e);
        }
    }

    // Read all sensor values
    public readSensorData(): any {
        const data = this.readWord(VEML6030_REG_ALS);

        // Calculate lux value (refer to VEML6030 datasheet for scaling factors)
        const gain = 1;                                               // Adjust based on your gain setting (e.g., 1x, 2x, etc.)
        const integrationTime = 100;                                  // Adjust based on your integration time (e.g., 100ms, 200ms, etc.)
        const lux = data * (0.0576 / gain) * (100 / integrationTime); // Example formula
      
        console.log(`Ambient Light: ${lux.toFixed(1)} lux`);
        return {};
    }
}