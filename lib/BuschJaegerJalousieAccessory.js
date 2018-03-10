"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerJalousieAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerJalousieAccessory.super_.apply(this, arguments);

    var windowCoveringService = new Service.WindowCovering();

    windowCoveringService.getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getCurrentPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.HoldPosition)
        .on('set', this.setHoldPosition.bind(this));

    this.services.windowCovering = windowCoveringService;

    this.moveTimeout = null;
    this.moving = false;
    this.movingTo = null;
}

BuschJaegerJalousieAccessory.prototype = {
    getCurrentPosition: function(callback) {
        if (callback) {
            callback(null, 100 - parseInt(this.getValue(this.channel, 'odp0001')));
        }
    },
    setTargetPosition: function(value, callback) {
        let currentPosition = 100 - parseInt(this.getValue(this.channel, 'odp0001'));
        let movingUpTime = parseInt(this.getValue(this.channel, 'pm0000'));
        let movingDownTime = parseInt(this.getValue(this.channel, 'pm0001'));

        this.platform.log('Jalousie '+ this.uuid_base + ' ' + currentPosition + ' -> ' + value);

        if (value < currentPosition) {
            // Down
            this.setValue(this.channel, 'idp0000', '1');

            if (value > 10) {
                let moveTimeout = (currentPosition - value) * movingDownTime * 10;
                this.moveTimeout = setTimeout(function() {
                    this.setHoldPosition(null, callback);
                }.bind(this), moveTimeout);
            } else {
                this.waitForUpdate(callback, this.channel, 'odp0000');
            }
        } else if (value > currentPosition) {
            // Up
            this.setValue(this.channel, 'idp0000', '0');
            if (value < 90) {
                let moveTimeout = (value - currentPosition) * movingUpTime * 10;
                this.moveTimeout = setTimeout(function() {
                    this.setHoldPosition(null, callback);
                }.bind(this), moveTimeout);
            } else {
                this.waitForUpdate(callback, this.channel, 'odp0000');
            }
        } else {
            // No Change
            callback();
            return;
        }

        this.moving = true;
        this.movingTo = value;
    },
    getPositionState: function(callback) {
        if (callback) {
            let state = this.Characteristic.PositionState.STOPPED;
            let stateVal = this.getValue(this.channel, 'odp0000');

            if (stateVal == '2') {
                state = this.Characteristic.PositionState.INCREASING;
            } else if (stateVal == '3') {
                state = this.Characteristic.PositionState.DECREASING;
            } else {
                if (this.moving) {
                    this.moving = false;
                    this.movingTo = null;
                }
            }

            callback(null, state);
        }
    },
    setHoldPosition: function(value, callback) {
        if (callback) {
            this.setValue(this.channel, 'idp0001', '1');
            /*
            * Once the position has changed we can call the callback
            * a user may readjust the position which then uses the new position.
            */
            this.waitForUpdate(callback, this.channel, 'odp0001');
        }

        if (this.moveTimeout) {
            clearTimeout(this.moveTimeout);
            this.moveTimeout = null;
        }
    },

    updateCharacteristics: function() {
        var that = this;

        this.getCurrentPosition(function(joker, value) {
            that.services.windowCovering.getCharacteristic(that.Characteristic.CurrentPosition).updateValue(value);
            if (that.moving) {
                that.services.windowCovering.getCharacteristic(that.Characteristic.TargetPosition).updateValue(that.movingTo);
            } else {
                that.services.windowCovering.getCharacteristic(that.Characteristic.TargetPosition).updateValue(value);
            }
        });

        this.getPositionState(function(joker, value) {
            that.services.windowCovering.getCharacteristic(that.Characteristic.PositionState).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerJalousieAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerJalousieAccessory;
