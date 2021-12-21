"use strict";
var util = require("util");
var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;
function BuschJaegerDoorBellAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerDoorBellAccessory.super_.apply(this, arguments);
    this.platform.log('exposing actuator ' + this.name + ' with uuid ' + this.uuid_base + ' as doorbell');
    var doorbellService = new Service.MotionSensor();
    doorbellService.getCharacteristic(Characteristic.MotionDetected)
        .on('get', this.getOn.bind(this));
    this.services.doorbell = doorbellService;
}
BuschJaegerDoorBellAccessory.prototype = {
    getOn: function (callback) {
        if (callback) {
            let mode = parseInt(this.getValue(this.channel, 'odp0000')) ? true : false;
            callback(null, mode);
        }
    },
    setOn: function (value, callback) {
        if (this.getValue(this.channel, 'idp0000') != value) {
            if (value) {
                this.setValue(this.channel, 'idp0000', '1');
                this.waitForUpdate(callback, this.channel, 'odp0000', '1');
            }
            else {
                this.setValue(this.channel, 'idp0000', '0');
                this.waitForUpdate(callback, this.channel, 'odp0000', '0');
            }
        }
        else {
            this.platform.log('Accessory is already turned on/off');
            callback();
        }
    },
    updateCharacteristics: function () {
        var that = this;
        this.getOn(function (joker, value) {
            if (value) {
                that.services.doorbell.getCharacteristic(that.Characteristic.MotionDetected).updateValue(value);
                setTimeout(function () {
                    that.setOn(0, function () {
                        that.services.doorbell.getCharacteristic(that.Characteristic.MotionDetected).updateValue(false);
                    });
                }.bind(that), 10000);
            }
        });
    }
};
util.inherits(BuschJaegerDoorBellAccessory, BuschJaegerAccessory);
module.exports = BuschJaegerDoorBellAccessory;
