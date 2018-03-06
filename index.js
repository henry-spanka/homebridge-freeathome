'use strict';

const path = require('path');

var Accessory, Service, Characteristic, UUIDGen;

const WebSocket = require('ws');

module.exports = function(homebridge) {
    console.log("homebridge API version: " + homebridge.version);

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = homebridge.platformAccessory;

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

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
                this.ws.send('info');
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
            that.accessoryCallback(that.foundAccessories);
            that.accessoryCallback = null;
            that.accessoryCallbackSet = false;
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
        let actuator = actuators[serial];
        let accessoryClass = this.getAccessoryClass(actuator['deviceId']);
        if (accessoryClass) {
            let service = require(path.join(__dirname, 'lib', accessoryClass));
            let accessory = new service(this, Service, Characteristic, actuator);

            acc.push(accessory);
        }
    }

    this.foundAccessories = acc;

}

BuschJaegerApPlatform.prototype.getAccessoryClass = function(deviceId) {
    switch (deviceId) {
        case '1004':
            return 'BuschJaegerThermostatAccessory';

        default:
            return null;
    }
}
