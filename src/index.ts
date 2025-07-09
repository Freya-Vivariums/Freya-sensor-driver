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
import { EventEmitter } from 'events';

//import BME680 from './bme680';

// D-Bus configuration
const DBUS_SERVICE   = 'io.freya.EnvironmentSensorDriver';
const DBUS_PATH    =  '/io/freya/EnvironmentSensorDriver';
const DBUS_INTERFACE = 'io.freya.EnvironmentSensorDriver';
let sampleInterval = 10*1000; // ms


class EnvSensorDriver extends EventEmitter {
  private sampleInterval = 10_000;

  constructor(private bus: any) {
    super();
    // export D-Bus interface as soon as we construct
    bus.exportInterface(
      this,
      DBUS_PATH,
      {
        name: DBUS_INTERFACE,
        methods: {
          setSampleInterval: ['i', 'b']
        },
        signals: {
          measurement: ['ss','s']
        }
      }
    );
  }

  // D-Bus-exposed method:
  setSampleInterval(interval: number): boolean {
    this.sampleInterval = interval;
    return true;
  }

  // whenever you want to send a new reading down the bus:
  public pushMeasurement(variable: string, value: string ) {
    // this.emit is EventEmitter.emit; dbus-native watches for it
    this.emit('measurement', variable, value);
  }
}

async function main() {
  const systemBus = dbus.systemBus();

  // 1) acquire the well-known name
  systemBus.requestName(DBUS_SERVICE, 0, (err: any, retCode: number) => {
    if (err) {
      console.error('Failed to request name:', err);
      process.exit(1);
    }
    if (retCode !== 1) {
      console.error('Name already taken or unexpected reply:', retCode);
      process.exit(1);
    }

    console.log(`Acquired ${DBUS_SERVICE} on system bus`);
    // 2) now we can create & export our driver
    const driver = new EnvSensorDriver(systemBus);

    // 3) periodically emit
    setInterval(() => {
      driver.pushMeasurement('temperature', '33');
    }, driver['sampleInterval']);
  });
}

main();