"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;

class BuschJaegerSmokeSensorAccessory extends BuschJaegerAccessory {
    constructor(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
        super(platform, Service, Characteristic, actuator, channel, mapping)

        var smokeService = new Service.SmokeSensor()

        smokeService.getCharacteristic(Characteristic.SmokeDetected)
            .on('get', this.getSmokeDetected.bind(this));
    
        this.services.smoke = smokeService;
    }

    getSmokeDetected(callback) {
        let detected = parseInt(this.getValue(this.channel, 'odp0000')) == 1 ? this.Characteristic.SmokeDetected.SMOKE_DETECTED : this.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED

        callback(null, detected)
    }

    updateCharacteristics() {
        this.getSmokeDetected((_, value) => this.services.smoke.getCharacteristic(this.Characteristic.SmokeDetected).updateValue(value))
    }
}

module.exports = BuschJaegerSmokeSensorAccessory
