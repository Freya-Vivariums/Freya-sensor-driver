/*
 *  Freya Sensor Driver
 *  The hardware-dependent component of the Freya Vivarium Control System, designed
 *  for use with the Edgeberry hardware (Base Board + Sense'n'Drive hardware cartridge)
 *  and the Freya Sensor (v1).
 *
 *  by Sanne 'SpuQ' Santens
 */
const dbus = require('dbus-native');
import i2c from 'i2c-bus';
import BME680 from './bme680';
import AS7331 from './as7331';
import VEML6030 from './veml6030';

// D-Bus service
const SERVICE_NAME="io.freya.EnvironmentSensorDriver";
const OBJECT_PATH    = '/io/freya/EnvironmentSensorDriver';
const INTERFACE_NAME = 'io.freya.EnvironmentSensorDriver';

const SAMPLE_INTERVAL=10*1000 // Sensor sample interval

// Open the I2C bus
const i2c_bus = i2c.openSync(1);
const bme680 = new BME680( 0x76, i2c_bus );
const as7331 = new AS7331( 0x74, i2c_bus);
const veml6030 = new VEML6030( 0x10, i2c_bus );

setInterval(()=>{
    console.log("Temperature: "+bme680.getTemperature()+"°C");
    console.log("Humidity: "+bme680.getHumidity()+"%");
    console.log("Pressure: "+bme680.getPressure()+"hPa");

    as7331.readSensorData();
    veml6030.readSensorData();

    // TODO: sensor data to Core
    //if(freyaCore) freyaCore.setMeasurement(JSON.stringify({variable:'humidity', value:humidity.toFixed(1)}));
}, SAMPLE_INTERVAL);

/* System DBus client */

const systemBus = dbus.systemBus();

// Request the DBus service name
systemBus.requestName( SERVICE_NAME,0, (err:any, code:any) => {
    if (err) {
      console.error('Failed to request D-Bus name:', err);
      process.exit(1);
    }
    if (code !== 1) {
      console.error(`Name ${SERVICE_NAME} is already taken (retCode=${code})`);
      process.exit(1);
    }
    console.log(`D-Bus name acquired: ${SERVICE_NAME}`);
    exportInterface();
  }
);


// Define and export our interface
function exportInterface() {
  // This object holds our method implementations and is also used to emit signals
  const ifaceImpl = {
    // Method: returns a dict of all current measurements
    GetMeasurements(callback: (err: any, measurements?: Record<string, number>) => void) {
        const data = readAllSensors();
        callback(null, data);
    },
    // Signal stub – calling this function sends the signal
    MeasurementsUpdated(_measurements: Record<string, number>) {
      /* Signal is emitted by calling this function */
    }
  };

  // Interface description
  const ifaceDesc = {
    name: INTERFACE_NAME,
    methods: {
      // signature: no in, one out of type a{sv} (dict<string,variant>)
      GetMeasurements: ['', 'a{sv}', [], ['measurements']]
    },
    signals: {
      // signal name and signature
      MeasurementsUpdated: ['a{sv}', ['measurements']]
    }
  };

  // Export on the bus
  systemBus.exportInterface(ifaceImpl, OBJECT_PATH, ifaceDesc);
  console.log(`Interface exported at ${OBJECT_PATH}`);

  // 3) Periodically emit the MeasurementsUpdated signal
  setInterval(() => {
    const data = readAllSensors();
    // @ts-ignore – calling the stub emits the signal
    ifaceImpl.MeasurementsUpdated(data);
    console.log('Emitted MeasurementsUpdated:', data);
  }, SAMPLE_INTERVAL);
}

// Helper to read all sensors
function readAllSensors(): Record<string, number> {
  const temp = parseFloat(bme680.getTemperature().toFixed(2));
  const hum = parseFloat(bme680.getHumidity().toFixed(2));
  const pres = parseFloat(bme680.getPressure().toFixed(2));
  const lightLux = veml6030.readSensorData(); // adjust based on actual return type

  return {
    temperature: temp,
    humidity:    hum,
    pressure:    pres,
    light:       lightLux
  };
}