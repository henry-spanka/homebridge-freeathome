"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerSchaltAktorAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerSchaltAktorAccessory.super_.apply(this, arguments);

    var outletService = new Service.Outlet();

    outletService.getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));

    this.services.outlet = outletService;
}

BuschJaegerSchaltAktorAccessory.prototype = {
    getOn: function(callback) {
        if (callback) {
            let mode = parseInt(this.getValue(this.channel, 'odp0000')) ? true : false;
            callback(null, mode);
        }
    },
    setOn: function(value, callback) {
        if (this.getValue(this.channel, 'idp0000') != value) {
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
    updateCharacteristics: function() {
        var that = this;

        this.getOn(function(joker, value) {
            that.services.outlet.getCharacteristic(that.Characteristic.On).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerSchaltAktorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerSchaltAktorAccessory;
