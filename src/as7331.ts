/*
 *  AS7331 - UVA/B/C spectrum sensor
 *  A TypeScript implementation for interfacing with the AS7331 
 *  spectral sensor via I2C.
 * 
 *  by Sanne 'SpuQ' Santens, late 2024
 */

// Register addresses
const AS7331_REG_STATUS = 0x00;     // Example: Status register
const AS7331_REG_CONFIG = 0x01;     // Example: Configuration register
const AS7331_REG_DATA_START = 0x10; // Example: Start of spectral data block


export default class AS7331 {
    private i2c_address:number|null = null;
    private i2c_interface:any|null = null;

    constructor( i2c_address:number, i2c_interface:any){
        this.i2c_address=i2c_address;
        this.i2c_interface=i2c_interface;

        // Initialize the sensor
        this.init();
    }

    // Function to write a byte to the sensor
    private writeByte(register: number, value: number): void {
        this.i2c_interface.writeByteSync(this.i2c_address, register, value);
    }

    // Function to read a block of bytes from the sensor
    private readBlock(register: number, length: number): Buffer {
        const buffer = Buffer.alloc(length);
        this.i2c_interface.readI2cBlockSync(this.i2c_address, register, length, buffer);
        return buffer;
    }

    // Initialize the sensor
    private init(): void {
        try{
            // Configuration: Set the required mode and settings (refer to the datasheet)
            this.writeByte(AS7331_REG_CONFIG, 0x01); // Example configuration value
        }
        catch(e){
            console.error("Failed to initialize AS7331: "+e);
        }
    }

    // Read all sensor values
    public readSensorData(): any {
        const dataLength = 12; // Example: Number of bytes for spectral data
        const data = this.readBlock(AS7331_REG_DATA_START, dataLength);

        // Parse spectral data (refer to the AS7331 datasheet for data format)
        const channel1 = (data[0] << 8) | data[1];
        const channel2 = (data[2] << 8) | data[3];
        const channel3 = (data[4] << 8) | data[5];
        const channel4 = (data[6] << 8) | data[7];
        const channel5 = (data[8] << 8) | data[9];
        const channel6 = (data[10] << 8) | data[11];

        console.log('Spectral Data:');
        console.log(`Channel 1: ${channel1}`);
        console.log(`Channel 2: ${channel2}`);
        console.log(`Channel 3: ${channel3}`);
        console.log(`Channel 4: ${channel4}`);
        console.log(`Channel 5: ${channel5}`);
        console.log(`Channel 6: ${channel6}`);

        return {};
    }
}