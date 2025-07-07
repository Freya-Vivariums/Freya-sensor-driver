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

// D-Bus configuration
const SERVICE_NAME   = 'io.freya.EnvironmentSensorDriver';
const OBJECT_PATH    = '/io/freya/EnvironmentSensorDriver';
const INTERFACE_NAME = 'io.freya.EnvironmentSensorDriver';
const SAMPLE_INTERVAL = 10*1000; // ms

// Initialize I2C and sensor
const i2cBus = i2c.openSync(1);
const sensor = new BME680(0x76, i2cBus);

// Connect to system bus and claim service name
const systemBus = dbus.systemBus();
systemBus.requestName(SERVICE_NAME, 0, (err:any, retCode:any) => {
  if (err) throw err;
  if (retCode !== 1) {
    console.error(`Name ${SERVICE_NAME} is taken, retCode=${retCode}`);
    process.exit(1);
  }
  console.log(`Acquired D-Bus name: ${SERVICE_NAME}`);
  exportInterface();
});

function exportInterface() {
  const ifaceImpl = {
    GetMeasurements: () => {
      return readMeasurements();
    },
    MeasurementsUpdated: (_data: Record<string, number>) => {}
  };

  const ifaceDesc = {
    name: INTERFACE_NAME,
    methods: {
      GetMeasurements: ['', 'a{d}', [], ['measurements']]
    },
    signals: {
      MeasurementsUpdated: ['a{d}', ['measurements']]
    }
  };

  systemBus.exportInterface(ifaceImpl, OBJECT_PATH, ifaceDesc);
  console.log(`Exported interface at ${OBJECT_PATH}`);

  setInterval(() => {
    const data = readMeasurements();
    // @ts-ignore: emit signal
    ifaceImpl.MeasurementsUpdated(data);
    console.log('Emitted MeasurementsUpdated:', data);
  }, SAMPLE_INTERVAL);
}

function readMeasurements(): Record<string, number> {
  const temperature = sensor.getTemperature();
  const humidity    = sensor.getHumidity();
  const pressure    = sensor.getPressure();
  const gas         = sensor.getGasResistance();
  return { temperature, humidity, pressure, gas };
}
