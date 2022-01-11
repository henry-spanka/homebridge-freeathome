'use strict';

const path = require('path');

var Service, Characteristic, Hap, PlatformAccessory

var APICLOUD = require('freeathome-api');
var APILOCAL = require(path.join(__dirname, 'dist', 'local-api'));
//var APILOCAL;
var API;

module.exports = function (homebridge) {
    console.log("homebridge API version: " + homebridge.version);

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Hap = homebridge.hap;
    PlatformAccessory = homebridge.platformAccessory;

    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-freeathome", "free@home", BuschJaegerApPlatform, true);

}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function BuschJaegerApPlatform(log, config, api) {
    this.log = log;
    this.hap = Hap;
    this.hApi = api;
    this.platformAccessory = PlatformAccessory;

    this.log('Initialising BuschJaeger Plugin');

    this.mappings = config.mappings;

    this.log('Will try to connect to the SysAP at %s', config.sysIP);

    if (config.isLocalAPI == true) {
        API = APILOCAL;
    } else {
        API = APICLOUD;
    }

    this.configuration = new API.ClientConfiguration(config.sysIP, config.username, config.password);

    this.accessoryCallback = null;
    this.accessoryCallbackSet = false;

    this.actuatorInfo = {};

    this.scheduler = null;

    this.connect();

    this.foundAccessories = [];

    this.config = config;
}

BuschJaegerApPlatform.prototype.accessories = function (callback) {
    this.accessoryCallback = callback;
    this.accessoryCallbackSet = true;
}

BuschJaegerApPlatform.prototype.transformAccessories = function (actuators) {
    let acc = [];

    for (let serial in actuators) {
        let mapping = {};
        if (this.mappings) {
            mapping = this.mappings.filter(obj => {
                return obj.actuatorID === serial
            })?.shift()
        }

        let actuator = actuators[serial];

        if (mapping!==undefined && mapping['blacklist']?.find(o => {return o.channelID === '*' })?.channelID!==undefined ) {
            this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + ' with serial ' + serial);
            continue;
        }

        if (Object.keys(actuator['channels']).length > 0) {
            for (let channelNo in actuator['channels']) {
                let channel = actuator['channels'][channelNo];

                let accessory = this.initializeAccessory(channelNo, actuator, channel, serial, mapping);

                if (accessory != null) {
                    acc.push(accessory);
                }
            }
            // some actuators do not expose their channels
        } else {
            let accessory = this.initializeAccessory(null, actuator, {}, serial, mapping);

            if (accessory != null) {
                acc.push(accessory);
            }
        }
    }

    this.foundAccessories = acc;

}

BuschJaegerApPlatform.prototype.initializeAccessory = function (channelNo, actuator, channel, serial, mapping) {

    actuator['serialNumber'] = serial;  // local API
    actuator['typeName'] = actuator['typeName'] ?? actuator['displayName'];
    let [accessoryClass, forcedChannel] = this.getAccessoryClass(actuator['deviceId'], channelNo, channel['functionId'] ?? channel['functionID'], channel['iconId'], channel['floor'] ?? actuator['floor'], channel['room'] ?? actuator['room'], mapping);

    if (channelNo == null) {
        channelNo = forcedChannel;
    }

    if (mapping!==undefined && mapping['blacklist']?.find(o => {return o.channelID === channelNo })?.channelID!==undefined ) {
        this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + '/' + channel['displayName'] + ' with serial ' + serial + ' and channel ' + channelNo);
        return;
    }

    if (accessoryClass == null) {
        this.log.debug('Ignoring non-supported accessory ' + actuator['typeName'] + '/' + channel['displayName'] + ' with serial ' + serial + ' and channel ' + channelNo);
        return;
    }

    if (channelNo != null) {
        let service = require(path.join(__dirname, 'dist/accessories', accessoryClass));

        return new service(this, Service, Characteristic, actuator, channelNo, mapping);
    }
}

BuschJaegerApPlatform.prototype.getAccessoryClass = function (deviceId, channel, functionId, iconId, floor, room, mapping) {
    if (!floor || !room) {
        return [null, null];
    }

    switch (deviceId) {
        case '1008': // Bewegungsmelder
        case '100A': // Bewegungsmelder/Schaltaktor 1-fach
            return ['BuschJaegerMotionSensorAccessory', 'ch0000'];
    }

    if (!iconId) {
        //return [null, null];
    }

    if (mapping!==undefined && 'doorbell' in mapping && channel in mapping['doorbell']) {
        let doorbell = mapping['doorbell'][channel];

        if (doorbell['video']) {
            return ['BuschJaegerVideoDoorBellAccessory', null];
        } else {
            return ['BuschJaegerDoorBellAccessory', null];
        }
    } else if (mapping!==undefined && 'garagedoor' in mapping && channel in mapping['garagedoor']) {
        return ['BuschJaegerGarageDoorAccessory', null];
    }

    switch (functionId) {
        case '4':
            return ['BuschJaegerBinarySensorAccessory', null];
        case '7':
            return ['BuschJaegerSchaltAktorAccessory', null];
        case '9':
        case '61':
            return ['BuschJaegerJalousieAccessory', null];
        case '11':
            return ['BuschJaegerMotionSensorAccessory', null];
        case '12':
            return ['BuschJaegerDimmAktorAccessory', null];
        case 'f':
            return ['BuschJaegerContactSensorAccessory', null];
        case '23':
            return ['BuschJaegerThermostatAccessory', null];
        case '1a':
            return ['BuschJaegerDoorLockAccessory', null];
        case '5a':
            return ['BuschJaegerMediaPlayerAccessory', null];
        case '7d':
            return ['BuschJaegerSmokeSensorAccessory', null];

        default:
            return [null, null];
    }
}

BuschJaegerApPlatform.prototype.setDatapoint = function (serial, channelNo, datapoint, value = null) {
    if ('debug' in this.config && this.config.debug) {
        this.log.warn("setDatapoint(): " + [serial, channelNo, datapoint, value.toString()].join('/'));
    }

    this.api.setDatapoint(serial, channelNo, datapoint, value.toString());
}

BuschJaegerApPlatform.prototype.connect = async function () {
    this.log('Trying to connect to SysAP');
    const that = this;

    this.api = new API.SystemAccessPoint(this.configuration, this, class {
        static log(...messages) {
            for (let message of messages) {
                that.log.info(message);
            }
        }

        static warn(...messages) {
            for (let message of messages) {
                that.log.warn(message);
            }
        }

        static error(...messages) {
            for (let message of messages) {
                that.log.error(message);
            }
        }

        static debug(...messages) {
            for (let message of messages) {
                that.log.debug(message);
            }
        }
    });

    try {
        await this.api.connect();
    } catch (e) {
        this.log.error(e.message);
    }
}

BuschJaegerApPlatform.prototype.processMessage = function (jsonData) {
    if ('debug' in this.config && this.config.debug) {
        this.log.warn("processMessage(): " + JSON.stringify(jsonData));
    }

    if (!('result' in jsonData)) {
        this.log.warn('Invalid message received.');
        return;
    }

    var isUpdate = false;

    if ('type' in jsonData && jsonData['type'] == 'update') {
        this.processUpdate(jsonData['result']);
        isUpdate = true;
    } else {
        // Full data received
        this.actuatorInfo = jsonData['result'];
    }

    if (this.accessoryCallbackSet && !isUpdate) {
        this.transformAccessories(jsonData['result']);

        /*
        There may be an edge case where the connection to the SysAP Node Plugin
        is established successfully but the SysAP Node Plugin can not authenticate against
        the SysAP and therefore returns no accessories. This will remove all devices from the
        HomeKit database.
        */
        if (this.foundAccessories.length >= 1) {
            // Only expose if accessory has more than one service (first is informationService)
            let filteredAccessories = this.foundAccessories.filter(accessory => accessory.getServices().length > 1);
            this.accessoryCallback(filteredAccessories);
            this.accessoryCallback = null;
            this.accessoryCallbackSet = false;
        }
    }
}

BuschJaegerApPlatform.prototype.processUpdate = function (actuators) {
    for (let serial in actuators) {
        for (let channel in actuators[serial]['channels']) {
            let channels = actuators[serial]['channels'][channel];
            if (this.actuatorInfo[serial]) {
                for (let datapoint in channels['datapoints']) {

                    if (!this.actuatorInfo[serial]['channels'][channel]) {
                        this.actuatorInfo[serial]['channels'][channel] = { 'datapoints': {} };
                    }

                    let value = channels['datapoints'][datapoint];
                    this.actuatorInfo[serial]['channels'][channel]['datapoints'][datapoint] = value;
                    this.sendUpdateToAccessory(serial, channel.replace('ch', ''), datapoint, value);
                }
                for (let datapoint in channels['outputs']) {
                    let value = channels['outputs'][datapoint];
                    // value is somehow a referenz to *['outputs'][datapoint] so we don't need to assign it here
                    //this.actuatorInfo[serial]['channels'][channel]['outputs'][datapoint] = value;
                    this.sendUpdateToAccessory(serial, channel.replace('ch', ''), datapoint, value);

                }
                for (let datapoint in channels['inputs']) {
                    let value = channels['inputs'][datapoint];
                    // value is somehow a referenz to *['outputs'][datapoint] so we don't need to assign it here              
                    //this.actuatorInfo[serial]['channels'][channel]['inputs'][datapoint] = value;
                    this.sendUpdateToAccessory(serial, channel.replace('ch', ''), datapoint, value);

                }
            }
        }
    }
}

BuschJaegerApPlatform.prototype.sendUpdateToAccessory = function (serial, channel, datapoint, value = null) {
    let accessory = this.findAccessoryBySerial(serial, channel);

    if (accessory) {
        accessory.update(channel, datapoint, value);
    }
}

BuschJaegerApPlatform.prototype.findAccessoryBySerial = function (sn, ch = null) {
    for (let i = 0; i < this.foundAccessories.length; i++) {
        if (this.foundAccessories[i].serial == sn) {
            if (!ch && !this.foundAccessories[i].channel) {
                return this.foundAccessories[i];
            }
            if (ch && this.foundAccessories[i].channel && this.foundAccessories[i].channel == ch) {
                return this.foundAccessories[i];
            }
        }
    }

    return null;
}

BuschJaegerApPlatform.prototype.broadcastMessage = function (message) {
    switch (message.type) {
        case 'error':
            this.log.error(message.result.message);
            break;
        case 'update':
            this.processMessage(message);
            break;
        case 'subscribed':
            if (message.result) {
                this.processMessage({ 'type': 'result', 'result': this.api.getDeviceData() });
            } else {
                this.log.error("Unsubscribed from System Access Point!");
            }
            break;
        default:
            this.log.warn("Unknown message type received: " + message.type);
    }
}
