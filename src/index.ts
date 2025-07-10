/*
 *  Freya Sensor Driver
 *  The hardware-dependent component of the Freya Vivarium Control System, designed
 *  for use with the Freya Sensor (v1).
 *
 *  Copyright© 2025 Sanne “SpuQ” Santens
 *  Released under the MIT License (see LICENSE.txt)
 */
const dbus = require('dbus-native');
import i2c from 'i2c-bus';
import { EventEmitter } from 'events';

//import BME680 from './bme680';

// D-Bus configuration
const DBUS_SERVICE   = 'io.freya.EnvironmentSensorDriver';
const DBUS_PATH    =  '/io/freya/EnvironmentSensorDriver';
const DBUS_INTERFACE = 'io.freya.EnvironmentSensorDriver';
// Sensor sample interval limits
const SAMPLEINT_MIN = 0.5           // 30 seconds
const SAMPLEINT_MAX = 12*60*60*1000 // 12 hours

class EnvSensorDriver extends EventEmitter {
  public sampleInterval = 10*1000;   // Default interval set to 10 seconds

  constructor(private bus: any) {
    super();
    // export D-Bus interface as soon as we construct
    bus.exportInterface(
      this,     // for emiting signals (?)
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
    // Reject interval settings that are out of bounds
    if( interval < SAMPLEINT_MIN || interval > SAMPLEINT_MAX ) return false;
    // Set the interval and return success
    this.sampleInterval = interval*1000;
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
      // dummy values for testing
      driver.pushMeasurement('temperature', '24.3');
      driver.pushMeasurement('humidity', '53.5');
    }, driver.sampleInterval);
  });
}

main();