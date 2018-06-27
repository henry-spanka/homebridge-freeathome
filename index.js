'use strict';

const path = require('path');

var Service, Characteristic, Hap, PlatformAccessory

const WebSocket = require('ws');

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
    this.api = api;
    this.platformAccessory = PlatformAccessory;

    this.log('Initialising BuschJaeger Plugin');

    this.sysIP = config.sysIP;
    this.updateInterval = config.updateInterval;
    this.mappings = config.mappings;

    this.log('Will try to connect to the SysAP at %s', this.sysIP);

    this.sysUrl = 'ws://' + this.sysIP + ':8001';

    this.reconnecting = null;

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

        if ('blacklist' in mapping && mapping['blacklist'].includes('*')) {
            this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + ' with serial ' + serial);
            continue;
        }

        let actuator = actuators[serial];
        let accessoryClass = this.getAccessoryClass(actuator['deviceId']);
        if (accessoryClass) {
            let service = require(path.join(__dirname, 'lib', accessoryClass));
            if (Object.keys(actuator['channels']).length > 0) {
                for (let channel in actuator['channels']) {
                    if ('blacklist' in mapping && mapping['blacklist'].includes(channel)) {
                        this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + ' with serial ' + serial + ' and channel ' + channel);
                        continue;
                    }

                    let accessory;

                    // Hack to expose DoorBell service.
                    if ('doorbell' in mapping && channel in mapping['doorbell']) {
                        let doorbell = mapping['doorbell'][channel];
                        let accessoryClass = this.getAccessoryClass('doorbell');
                        if (doorbell['video']) {
                            accessoryClass = this.getAccessoryClass('videodoorbell');
                        }

                        let service = require(path.join(__dirname, 'lib', accessoryClass));
                        accessory = new service(this, Service, Characteristic, actuator, channel, mapping);
                    } else if ('garagedoor' in mapping && channel in mapping['garagedoor']) {
                        let garagedoor = mapping['garagedoor'][channel];
                        let accessoryClass = this.getAccessoryClass('garagedoor');

                        let service = require(path.join(__dirname, 'lib', accessoryClass));
                        accessory = new service(this, Service, Characteristic, actuator, channel, mapping);
                    } else {
                        accessory = new service(this, Service, Characteristic, actuator, channel, mapping);
                    }

                    acc.push(accessory);
                }
            } else {
                this.log('Found supported accessory ' + actuator['typeName'] + ' with serial ' + serial + ' but no channels detected. Is this a bug?');
            }
        } else {
            this.log('Ignoring non-supported accessory ' + actuator['typeName'] + ' with serial ' + serial);
        }
    }

    this.foundAccessories = acc;

}

BuschJaegerApPlatform.prototype.getAccessoryClass = function(deviceId) {
    switch (deviceId) {
        case '1004':
            return 'BuschJaegerThermostatAccessory';
        case 'B001':
        case '1015':
        case '1013':
            return 'BuschJaegerJalousieAccessory';
        case 'B008':
        case 'B002':
        case '100C':
        case '1010':
            return 'BuschJaegerSchaltAktorAccessory';
        case '1021':
        case '101C':
            return 'BuschJaegerDimmAktorAccessory';
        case '0001':
            return 'BuschJaegerMediaPlayerAccessory';
        case 'doorbell':
            return 'BuschJaegerDoorBellAccessory';
        case 'videodoorbell':
            return 'BuschJaegerVideoDoorBellAccessory';
        case 'garagedoor':
            return 'BuschJaegerGarageDoorAccessory';

        default:
            return null;
    }
}

BuschJaegerApPlatform.prototype.send = function(message) {
    this.ws.send(message, function ack(error) {
        if (error) {
            this.log('Message could not be sent to the SysAp.');
        }
    }.bind(this));
}

BuschJaegerApPlatform.prototype.connect = function() {
    this.log('Trying to connect to SysAP');
    const that = this;

    if (this.ws) {
        this.ws.removeAllListeners();
    }

    this.ws = new WebSocket(this.sysUrl);

    this.ws.on('open', function open() {
        that.log('Successfully connected to the SysAP');

        let interval = 60;

        if (that.updateInterval && that.updateInterval > 0) {
            interval = that.updateInterval;
        }

        if (!that.scheduler) {
            that.scheduler = setInterval(function() {
                this.update();
            }.bind(that), interval * 1000);
        }

        if (that.reconnecting) {
            clearInterval(that.reconnecting);
            that.reconnecting = null;
        }

        that.update();
    });

    this.ws.on('error', function error() {
        that.log('Error while communicating with SysAp');
    });

    this.ws.on('close', function close() {
        that.log('Disconnected from SysAP');

        if (that.scheduler) {
            clearInterval(that.scheduler);
            that.scheduler = null;
        }

        if (!that.reconnecting) {
            that.reconnecting = setInterval(function() {
                this.connect();
            }.bind(that), 10000);
        }
    });

    this.ws.on('message', function incoming(data) {
        that.log('Received a message from websocket');

        that.processMessage(data);
    });
}

BuschJaegerApPlatform.prototype.processMessage = function(message) {
    let jsonData = JSON.parse(message);

    if (!('result' in jsonData)) {
        this.log('Invalid message received.');
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
        this.transformAccessories(JSON.parse(message)['result']);

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

BuschJaegerApPlatform.prototype.update = function() {
    this.send('info');
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
