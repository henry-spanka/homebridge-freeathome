'use strict';

const path = require('path');

var Service, Characteristic

const WebSocket = require('ws');

module.exports = function(homebridge) {
    console.log("homebridge API version: " + homebridge.version);

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-buschjaeger", "BuschJaegerSysAp", BuschJaegerApPlatform);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function BuschJaegerApPlatform(log, config) {
    this.log = log;

    this.log('Initialising BuschJaeger Plugin');

    this.sysIP = config.sysIP;
    this.updateInterval = config.updateInterval;
    this.mappings = config.mappings;

    this.log('Will try to connect to the SysAP at %s', this.sysIP);

    this.ws = new WebSocket('ws://' + this.sysIP + ':8001');

    this.accessoryCallback = null;
    this.accessoryCallbackSet = false;

    this.actuatorInfo = {};

    this.scheduler = null;

    const that = this;

    this.ws.on('open', function open() {
        that.log('Successfully connected to the SysAP');

        let interval = 10;

        if (that.updateInterval && that.updateInterval > 0) {
            interval = that.updateInterval;
        }

        if (!that.scheduler) {
            that.scheduler = setInterval(function() {
                this.update();
            }.bind(that), interval*1000);
        }
    });

    this.ws.on('close', function close() {
        that.log('Disconnected from SysAP');

        if(that.scheduler) {
            clearInterval(scheduler);
            that.scheduler = null;
        }
    });

    this.ws.on('message', function incoming(data) {
        that.log('Received a message from websocket');

        let jsonData = JSON.parse(data);

        if (!('result' in jsonData)) {
            return;
        }

        that.actuatorInfo = jsonData['result'];

        if (that.accessoryCallbackSet) {
            that.transformAccessories(JSON.parse(data)['result']);

            /*
            There may be an edge case where the connection to the SysAP Node Plugin
            is established successfully but the SysAP Node Plugin can not authenticate against
            the SysAP and therefore returns no accessories. This will remove all devices from the
            HomeKit database.
            */

            if (that.foundAccessories.length > 1) {
                that.accessoryCallback(that.foundAccessories);
                that.accessoryCallback = null;
                that.accessoryCallbackSet = false;
            }
        }
    });

    this.foundAccessories = [];

    this.config = config;
}

BuschJaegerApPlatform.prototype.accessories = function(callback) {
    this.accessoryCallback = callback;
    this.accessoryCallbackSet = true;
}

BuschJaegerApPlatform.prototype.transformAccessories = function (actuators) {
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
            if (Object.keys(actuator['channels']).length > 1) {
                for (let channel in actuator['channels']) {
                    if ('blacklist' in mapping && mapping['blacklist'].includes(channel)) {
                        this.log('Ignoring blacklisted accessory ' + actuator['typeName'] + ' with serial ' + serial + ' and channel ' + channel);
                        continue;
                    }

                    let accessory = new service(this, Service, Characteristic, actuator, channel, mapping);
                    acc.push(accessory);
                }
            } else {
                let accessory = new service(this, Service, Characteristic, actuator, null, mapping);
                acc.push(accessory);
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
            return 'BuschJaegerJalousieAccessory';
        case 'B008':
            return 'BuschJaegerSchaltAktorAccessory';
        case '1021':
            return 'BuschJaegerDimmAktorAccessory';

        default:
            return null;
    }
}

BuschJaegerApPlatform.prototype.update = function() {
    this.ws.send('info');
}
