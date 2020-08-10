'use strict';

const path = require('path');

var Service, Characteristic, Hap, PlatformAccessory

const API = require('freeathome-api');

module.exports = function(homebridge) {
    console.log("homebridge API version: " + homebridge.version);

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Hap = homebridge.hap;
    PlatformAccessory = homebridge.platformAccessory;

    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-buschjaeger", "BuschJaegerSysAp", BuschJaegerApPlatform);
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

    this.configuration = new API.ClientConfiguration(config.sysIP, config.username, config.password);

    this.accessoryCallback = null;
    this.accessoryCallbackSet = false;

    this.actuatorInfo = {};

    this.scheduler = null;

    this.connect();

    this.foundAccessories = [];

    this.config = config;
}

BuschJaegerApPlatform.prototype.accessories = function(callback) {
    this.accessoryCallback = callback;
    this.accessoryCallbackSet = true;
}

BuschJaegerApPlatform.prototype.transformAccessories = function(actuators) {
    let acc = [];

    for (let serial in actuators) {
        let mapping = {};
        if (this.mappings && serial in this.mappings) {
            mapping = this.mappings[serial];
        }

        let actuator = actuators[serial];

        if ('blacklist' in mapping && mapping['blacklist'].includes('*')) {
            this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + ' with serial ' + serial);
            continue;
        }

        if (Object.keys(actuator['channels']).length > 0) {
            for (let channelNo in actuator['channels']) {
                let channel = actuator['channels'][channelNo];

                if ('blacklist' in mapping && mapping['blacklist'].includes(channelNo)) {
                    this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + '/' + channel['displayName'] + ' with serial ' + serial + ' and channel ' + channelNo);
                    continue;
                }

                let [accessoryClass, requireWhitelisted] = this.getAccessoryClass(actuator['deviceId'], channelNo, channel['functionId'], channel['iconId'], channel['floor'], channel['room'], mapping);

                if (accessoryClass == null) {
                    this.log.debug('Ignoring non-supported accessory ' + actuator['typeName'] + '/' + channel['displayName'] + ' with serial ' + serial + ' and channel ' + channelNo);
                    continue;
                }

                if (requireWhitelisted && (!('whitelist' in mapping) || !mapping['whitelist'].includes(channel))) {
                    this.log('Ignoring non-whitelisted accessory ' + actuator['typeName'] + '/' + channel['displayName'] + ' with serial ' + serial + ' and channel ' + channelNo);
                    continue;
                }

                let service = require(path.join(__dirname, 'lib', accessoryClass));
                let accessory = new service(this, Service, Characteristic, actuator, channelNo, mapping);

                acc.push(accessory);
            }
        }
    }

    this.foundAccessories = acc;

}

BuschJaegerApPlatform.prototype.getAccessoryClass = function(deviceId, channel, functionId, iconId, floor, room, mapping) {
    if (!iconId || !floor || !room) {
        return [null, false];
    }

    if ('doorbell' in mapping && channel in mapping['doorbell']) {
        let doorbell = mapping['doorbell'][channel];

        if (doorbell['video']) {
            return ['BuschJaegerVideoDoorBellAccessory', false];
        } else {
            return ['BuschJaegerDoorBellAccessory', false];
        }
    }  else if ('garagedoor' in mapping && channel in mapping['garagedoor']) {
        return ['BuschJaegerGarageDoorAccessory', false];
    }

    switch (functionId) {
        case '4':
            return ['BuschJaegerBinarySensorAccessory', false];
        case '7':
            return ['BuschJaegerSchaltAktorAccessory', false];
        case '9':
            return ['BuschJaegerJalousieAccessory', false];
        case '12':
            return ['BuschJaegerDimmAktorAccessory', false];
        case '23':
            return ['BuschJaegerThermostatAccessory', false];
        case '1a':
            return ['BuschJaegerDoorLockAccessory', false];
        case '5a':
            return ['BuschJaegerMediaPlayerAccessory', false];

        default:
            return [null, false];
    }
}

BuschJaegerApPlatform.prototype.setDatapoint = function(serial, channelNo, datapoint, value = null) {
    this.api.setDatapoint(serial, channelNo, datapoint, value.toString());
}

BuschJaegerApPlatform.prototype.connect = async function() {
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
    } catch(e) {
        this.log.error(e.message);
    }
}

BuschJaegerApPlatform.prototype.processMessage = function(jsonData) {
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

BuschJaegerApPlatform.prototype.processUpdate = function(actuators) {
    for (let serial in actuators) {
        for (let channel in actuators[serial]['channels']) {
            let channels = actuators[serial]['channels'][channel];
            for (let datapoint in channels['datapoints']) {
                if (this.actuatorInfo[serial]) {
                    if (!this.actuatorInfo[serial]['channels'][channel]) {
                        this.actuatorInfo[serial]['channels'][channel] = {'datapoints': {}};
                    }

                    let value = channels['datapoints'][datapoint];
                    this.actuatorInfo[serial]['channels'][channel]['datapoints'][datapoint] = value;
                    this.sendUpdateToAccessory(serial, channel.replace('ch',''), datapoint, value);
                }
            }
        }
    }
}

BuschJaegerApPlatform.prototype.sendUpdateToAccessory = function(serial, channel, datapoint, value = null) {
    let accessory = this.findAccessoryBySerial(serial, channel);

    if (accessory) {
        accessory.update(channel, datapoint, value);
    }
}

BuschJaegerApPlatform.prototype.findAccessoryBySerial = function(sn, ch = null) {
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

BuschJaegerApPlatform.prototype.broadcastMessage = function(message) {
    switch (message.type) {
        case 'error':
            this.log.error(message.result.message);
            break;
        case 'update':
            this.processMessage(message);
            break;
        case 'subscribed':
            if (message.result) {
                this.processMessage({'type': 'result', 'result': this.api.getDeviceData()});
            } else {
                this.log.error("Unsubscribed from System Access Point!");
            }
            break;
        default:
            this.log.warn("Unknown message type received: " + message.type);
    }
}
