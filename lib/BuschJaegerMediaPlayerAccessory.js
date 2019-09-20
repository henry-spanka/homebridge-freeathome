"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerMediaPlayerAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerMediaPlayerAccessory.super_.apply(this, arguments);

    this.channel = '0000';

    /*
    * Speaker Service is not yet supported
    * See: https://github.com/ebaauw/homebridge-zp/issues/21
    */
    var switchService = new Service.Switch();

    switchService.getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));

    this.services.switch = switchService;
}

BuschJaegerMediaPlayerAccessory.prototype = {
    getOn: function(callback) {
        if (callback) {
            // free@home reports a value of 2 when two speaker zones are grouped but not currently playing
            // so we must do an explicit check.
            let status = parseInt(this.getValue(this.channel, 'odp0000')) == 1;

            callback(null, status);
        }
    },
    setOn: function(value, callback) {
        if (value) {
            this.setValue(this.channel, 'idp0000', '1');
        } else {
            this.setValue(this.channel, 'idp0001', '1');
        }

        this.waitForUpdate(callback, this.channel, 'odp0000');
    },

    updateCharacteristics: function() {
        var that = this;

        this.getOn(function(joker, value) {
            that.services.switch.getCharacteristic(that.Characteristic.On).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerMediaPlayerAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerMediaPlayerAccessory;
