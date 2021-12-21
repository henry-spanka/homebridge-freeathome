"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerDimmAktorAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerDimmAktorAccessory.super_.apply(this, arguments);

    var lightBulbService = new Service.Lightbulb();

    lightBulbService.getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));

    lightBulbService.getCharacteristic(Characteristic.Brightness)
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));

    let minBrightness = parseInt(this.getValue(this.channel, 'pm0001'));

    if (minBrightness > 1 && minBrightness < 100) {
        lightBulbService.getCharacteristic(Characteristic.Brightness)
        .setProps({
            minValue: minBrightness
        });
    }

    this.services.lightBulb = lightBulbService;
}

BuschJaegerDimmAktorAccessory.prototype = {
    getOn: function(callback) {
        if (callback) {
            let mode = parseInt(this.getValue(this.channel, 'odp0000')) ? true : false;
            callback(null, mode);
        }
    },
    setOn: function(value, callback) {
        if (this.getValue(this.channel, 'odp0000') != value) {
            if (value) {
                this.setValue(this.channel, 'idp0000', '1');
                this.waitForUpdate(callback, this.channel, 'odp0000', '1');
            } else {
                this.setValue(this.channel, 'idp0000', '0');
                this.waitForUpdate(callback, this.channel, 'odp0000', '0');
            }
        } else {
            this.platform.log('Accessory is already turned on/off');
            callback();
        }
    },
    getBrightness: function(callback) {
        if (callback) {
            let brightness = parseInt(this.getValue(this.channel, 'odp0001'));
            callback(null, brightness);
        }
    },
    setBrightness: function(value, callback) {
        this.setValue(this.channel, 'idp0002', value);

        this.waitForUpdate(callback, this.channel, 'odp0001');
    },
    updateCharacteristics: function() {
        var that = this;

        this.getOn(function(joker, value) {
            that.services.lightBulb.getCharacteristic(that.Characteristic.On).updateValue(value);
        });
        this.getBrightness(function(joker, value) {
            that.services.lightBulb.getCharacteristic(that.Characteristic.Brightness).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerDimmAktorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerDimmAktorAccessory;
