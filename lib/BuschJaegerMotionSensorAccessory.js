"use strict";

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;

class BuschJaegerMotionSensorAccessory extends BuschJaegerAccessory {
    constructor(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
        super(platform, Service, Characteristic, actuator, channel, mapping)

        var motionService = new Service.MotionSensor()

        motionService.getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.getMotionDetected.bind(this));
    
        this.services.motion = motionService;
    }

    getMotionDetected(callback) {
        // henry-spanka: The motion sensors I have tested do not expose any channels via the master update so the datapoint might be null at first
        let val = this.getValue(this.channel, 'odp0000')

        if (val === null) {
            val = 0
        }

        let detected = parseInt(val) == 1 ? 1 : 0

        callback(null, detected)
    }

    updateCharacteristics() {
        this.getMotionDetected((_, value) => this.services.motion.getCharacteristic(this.Characteristic.MotionDetected).updateValue(value))
    }
}

module.exports = BuschJaegerMotionSensorAccessory
