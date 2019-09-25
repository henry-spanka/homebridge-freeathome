"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerBinarySensorAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerBinarySensorAccessory.super_.apply(this, arguments);

     if (mapping == null || !("binarysensor" in mapping) || !(channel in mapping['binarysensor'])) {
         this.platform.log("No configuration set for binary sensor. Accessory will not be configured.");
         return;
     }

    this.mapping = mapping['binarysensor'][channel];

    if (!("datapoint" in this.mapping)) {
        this.platform.log("No datapoint to monitor configured. Accessory will not be configured.");
        return;
    }

    this.stopDelay = 0;
    this.stopDelayTimer = null;

    if ("stopDelay" in this.mapping && parseInt(this.mapping["stopDelay"]) > 0) {
        this.stopDelay = parseInt(this.mapping["stopDelay"]);
    }

    this.serviceDescriptor = {
        service: null,
        characteristic: null,
        values: {
            "active": null,
            "inactive": null
        },
        datapoint: this.mapping['datapoint'],
        invert: "invert" in this.mapping && this.mapping["invert"]
    };

    this.state = undefined;

    switch (this.mapping['type']) {
        case 'ContactSensor':
            this.serviceDescriptor.service = Service.ContactSensor;
            this.serviceDescriptor.characteristic = Characteristic.ContactSensorState;
            this.serviceDescriptor.values.active = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
            this.serviceDescriptor.values.inactive = Characteristic.ContactSensorState.CONTACT_DETECTED;
            break;
        case 'SmokeSensor':
            this.serviceDescriptor.service = Service.SmokeSensor;
            this.serviceDescriptor.characteristic = Characteristic.SmokeDetected;
            this.serviceDescriptor.values.active = Characteristic.SmokeDetected.SMOKE_DETECTED;
            this.serviceDescriptor.values.inactive = Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
            break;
        default:
            this.platform.log("Invalid mapping type for binary sensor received. Accessory will not be configured.");
            return;
    }

    let sensorService = new this.serviceDescriptor.service();
    sensorService.getCharacteristic(this.serviceDescriptor.characteristic)
        .on('get', this.getState.bind(this))

    this.services.sensorService = sensorService;

    this.initialize();
}

BuschJaegerBinarySensorAccessory.prototype = {
    initialize: function() {
        let state = !!parseInt(this.getValue(this.channel, this.serviceDescriptor.datapoint));

        this.state = this.transformState(state);

        this.waitForUpdate(this.changeDetected.bind(this), this.channel, this.serviceDescriptor.datapoint, null, -1);
    },
    changeDetected: function(err, value) {
        if (err) {
            this.platform.log("Unknown error occurred in changeDetected()");
        } else {
            let state = !!parseInt(value);
            state = this.transformState(state);

            if (state == this.serviceDescriptor.values.active) {
                if (this.stopDelayTimer !== null) {
                    clearTimeout(this.stopDelayTimer);
                    this.stopDelayTimer = null;
                } else {
                    this.state = state;
                    this.services.sensorService.getCharacteristic(this.serviceDescriptor.characteristic).updateValue(this.state);
                }
            } else if (state == this.serviceDescriptor.values.inactive) {
                if (this.stopDelay > 0 && this.stopDelayTimer === null) {
                    this.stopDelayTimer = setTimeout(this.stopDelayCallback.bind(this), this.stopDelay * 1000);
                } else {
                    this.state = state;
                    this.services.sensorService.getCharacteristic(this.serviceDescriptor.characteristic).updateValue(this.state);
                }
            }
        }
    },
    stopDelayCallback: function() {
        this.state = this.serviceDescriptor.values.inactive;
        this.services.sensorService.getCharacteristic(this.serviceDescriptor.characteristic).updateValue(this.state);

        this.stopDelayTimer = null;
    },
    getState: function (callback) {
        if (callback) {
            callback(null, this.state);
        }
    },
    transformState: function (state) {
        if (this.serviceDescriptor.invert) {
            state = !state;
        }

        if (state) {
            return this.serviceDescriptor.values.active;
        } else {
            return this.serviceDescriptor.values.inactive;
        }
    },
    updateCharacteristics: function () {
        //
    }
}

util.inherits(BuschJaegerBinarySensorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerBinarySensorAccessory;
