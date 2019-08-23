"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerBinarySensorAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerBinarySensorAccessory.super_.apply(this, arguments);

    this.mapping = mapping['binarysensor'][channel];

    if (!("datapoint" in this.mapping)) {
        this.platform.log("No datapoint to monitor configured. Accessory will not be configured.");
        return;
    }

    this.serviceDescriptor = {
        service: null,
        characteristic: null,
        values: {
            "active": null,
            "inactive": null
        },
        datapoint: this.mapping['datapoint'],
        invert: "invert" in this.mapping && this.mapping["invert"] == "true"
    };

    switch (this.mapping['type']) {
        case 'ContactSensor':
            this.serviceDescriptor.service = Service.ContactSensor;
            this.serviceDescriptor.characteristic = Characteristic.ContactSensorState;
            this.serviceDescriptor.values.active = Characteristic.ContactSensorState.CONTACT_DETECTED;
            this.serviceDescriptor.values.inactive = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
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
}

BuschJaegerBinarySensorAccessory.prototype = {
    getState: function (callback) {
        if (callback) {
            let state = parseInt(this.getValue(this.channel, this.datapoint)) ? true : false;

            if (this.serviceDescriptor.invert) {
                state = !state;
            }

            if (state) {
                callback(null, this.serviceDescriptor.values.active);
            } else {
                callback(null, this.serviceDescriptor.values.inactive);
            }
        }
    },
    updateCharacteristics: function () {
        var that = this;

        this.getState(function (joker, value) {
            that.services.sensorService.getCharacteristic(that.serviceDescriptor.characteristic).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerBinarySensorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerBinarySensorAccessory;
