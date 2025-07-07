/*
 *  Freya hardware
 *  The hardware-dependent component of the Freya Vivarium Control System, designed
 *  for use with the Edgeberry hardware (Base Board + Sense'n'Drive hardware cartridge)
 *  and the Freya Sensor (v1).
 *
 *  by Sanne 'SpuQ' Santens
 */
const dbus = require('dbus-native');
import { exec } from 'child_process'; 
import i2c from 'i2c-bus';
import BME680 from './bme680';
import AS7331 from './as7331';
import VEML6030 from './veml6030';

// D-Bus service
const SERVICE_NAME="io.freya.Core";
const SIGNAL_NAME="updateActuator";

// Edgeberry Digital outputs
const GPIO_LIGHTS="21";       // Digital out 1
const GPIO_HEATER="20";       // Digital out 2
const GPIO_RAIN="16";         // Digital out 3
const GPIO_VENTILATION="12"   // Digital out 5
const GPIO_TLIGHTS="18";      // Digital out 6 - Transitional lights

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



/* GPIO controls for the Sense'n'Drive Cartridge digital outputs */
function setDigitalOutput( digitalOutput:string, state:string ){
    const digitalState = state==='on'?'dh':'dl';
    try{
        exec("pinctrl set "+digitalOutput+" op "+digitalState);
    }
    catch(e){
        console.log("Failed to set Digital Output: "+e);
    }
}

/* System DBus client */
const systemBus = dbus.systemBus();
let freyaCore:any|null;

function subscribeToFreyaCore(){
    // Listen for signals from Freya Core
    systemBus.getService('io.freya.Core').getInterface( '/io/freya/Core', 
                                                        'io.freya.Core',
                                                        (err:any, iface:any)=>{
                                                            if(err) return console.log(err);
                                                            freyaCore = iface;
                                                            freyaCore.on(SIGNAL_NAME, setActuator );
                                                        }
    );
}

// initial subscription
subscribeToFreyaCore();

// Function to handle Freya Core service restart
// by listening to NameOwnerChanged signal
function monitorService() {
    systemBus.getService('org.freedesktop.DBus').getInterface(
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        (err:any, iface:any) => {
            if (err) return console.error('Failed to get DBus interface:', err);
            iface.on('NameOwnerChanged', (name:string, oldOwner:string, newOwner:string) => {
                if (name === SERVICE_NAME) {
                    if (oldOwner && !newOwner) {
                        console.log('Service has stopped. Removing event listeners from interface');
                        if(freyaCore) freyaCore.off(SIGNAL_NAME);
                    } else if (!oldOwner && newOwner) {
                        console.log('Service has started.');
                        subscribeToFreyaCore(); // Re-subscribe to signals
                    }
                }
            });
        }
    );
}

monitorService();

// When actuator data is received from the
// Freya Core, update the physical actuators
function setActuator( data:string ){
        console.log(data)
        try{
            // Parse the data to JSON
            const actuatorData = JSON.parse(data);

            switch(actuatorData.actuator){
                case 'lights':  setDigitalOutput( GPIO_LIGHTS, actuatorData.value );
                                break;
                case 'translights':  setDigitalOutput( GPIO_TLIGHTS, actuatorData.value );
                                break;
                case 'rain':    setDigitalOutput( GPIO_RAIN, actuatorData.value );
                                break;
                case 'heater':  setDigitalOutput( GPIO_HEATER, actuatorData.value );
                                break;
                case 'cooler':  setDigitalOutput( GPIO_VENTILATION, actuatorData.value );
                                break;
                default: break;
            }
        }
        catch( err ){
            console.error("Unable to parse actuator data!");
        }
}


