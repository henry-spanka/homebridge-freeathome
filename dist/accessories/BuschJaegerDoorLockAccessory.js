"use strict";
var util = require("util");
var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;
function BuschJaegerDoorLockAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerDoorLockAccessory.super_.apply(this, arguments);
    let lockService = new Service.LockMechanism();
    lockService.getCharacteristic(Characteristic.LockCurrentState)
        .on('get', this.getCurrentLockState.bind(this));
    lockService.getCharacteristic(Characteristic.LockTargetState)
        .on('get', this.getTargetLockState.bind(this))
        .on('set', this.setTargetLockState.bind(this));
    this.services.lock = lockService;
}
BuschJaegerDoorLockAccessory.prototype = {
    getCurrentLockState: function (callback) {
        if (callback) {
            let state = parseInt(this.getValue(this.channel, 'odp0000')) ? true : false;
            callback(null, state ? this.Characteristic.LockCurrentState.UNSECURED : this.Characteristic.LockCurrentState.SECURED);
        }
    },
    getTargetLockState: function (callback) {
        this.getCurrentLockState(callback);
    },
    setTargetLockState: function (value, callback) {
        let currentState = this.getValue(this.channel, 'odp0000');
        if (value == this.Characteristic.LockTargetState.UNSECURED) {
            if (currentState == '0') {
                this.setValue(this.channel, 'idp0000', '1');
                this.waitForUpdate(callback, this.channel, 'odp0000', '1');
            }
            else {
                callback();
            }
        }
        else if (value == this.Characteristic.LockTargetState.SECURED) {
            if (currentState == '1') {
                this.setValue(this.channel, 'idp0000', '0');
                this.waitForUpdate(callback, this.channel, 'odp0000', '0');
            }
            else {
                callback();
            }
        }
        else {
            callback("Unknown action");
        }
    },
    updateCharacteristics: function () {
        var that = this;
        this.getCurrentLockState(function (joker, value) {
            that.services.lock.getCharacteristic(that.Characteristic.LockCurrentState).updateValue(value);
        });
        this.getTargetLockState(function (joker, value) {
            that.services.lock.getCharacteristic(that.Characteristic.LockTargetState).updateValue(value);
        });
    }
};
util.inherits(BuschJaegerDoorLockAccessory, BuschJaegerAccessory);
module.exports = BuschJaegerDoorLockAccessory;
