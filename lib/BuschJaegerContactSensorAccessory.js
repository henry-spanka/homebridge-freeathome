"use strict";

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;

class BuschJaegerContactSensorAccessory extends BuschJaegerAccessory {
    constructor(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
        super(platform, Service, Characteristic, actuator, channel, mapping)

        this.stateChangeDataPoint = 'odp0000';

        if (mapping != null
        && 'contactsensor' in mapping
        && channel in mapping['contactsensor']
        && 'datapoint' in mapping['contactsensor'][channel]) {
            this.stateChangeDataPoint = mapping['contactsensor'][channel]['datapoint'];
            this.platform.log("Overriding ContactSensor state datapoint: " + this.name + " -> " + this.stateChangeDataPoint);
            return;
        }

        var contactService = new Service.ContactSensor()

        contactService.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', this.getContactSensorState.bind(this));
    
        this.services.contact = contactService;
    }

    getContactSensorState(callback) {
        let detected = parseInt(this.getValue(this.channel, this.stateChangeDataPoint)) == 1 ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : this.Characteristic.ContactSensorState.CONTACT_DETECTED

        callback(null, detected)
    }

    updateCharacteristics() {
        this.getContactSensorState((_, value) => this.services.contact.getCharacteristic(this.Characteristic.ContactSensorState).updateValue(value))
    }
}

module.exports = BuschJaegerContactSensorAccessory
