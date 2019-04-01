"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerJalousieAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerJalousieAccessory.super_.apply(this, arguments);

    var windowCoveringService = new Service.WindowCovering();

    windowCoveringService.getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));
    windowCoveringService.getCharacteristic(Characteristic.HoldPosition)
        .on('set', this.setHoldPosition.bind(this));

    this.services.windowCovering = windowCoveringService;
}

BuschJaegerJalousieAccessory.prototype = {
    getCurrentPosition: function(callback) {
        if (callback) {
            callback(null, 100 - parseInt(this.getValue(this.channel, 'odp0001')));
        }
    },
    getTargetPosition: function(callback) {
        if (callback) {
            let targetPos = this.getValue(this.channel, 'idp0002');

            if (targetPos === undefined) {
                callback(null, 100 - parseInt(this.getValue(this.channel, 'odp0001')));
            } else {
                callback(null, 100 - parseInt(targetPos));
            }
        }
    },
    setTargetPosition: function(value, callback) {
        let currentPosition = 100 - parseInt(this.getValue(this.channel, 'odp0001'));
        let targetPosition = 100 - parseInt(value);

        this.platform.log('Jalousie '+ this.uuid_base + ' ' + currentPosition + ' -> ' + value);

        if (value != currentPosition) {
            this.setValue(this.channel, 'idp0002', targetPosition);
            this.waitForUpdate(callback, this.channel, 'odp0000');
        } else {
            // No Change
            callback();
            return;
        }
    },
    /*
    * PositionState is not used as Apple derives the PositionState
    * from the CurrentPosition and the TargetPosition
    */
    getPositionState: function(callback) {
        if (callback) {
            let state = this.Characteristic.PositionState.STOPPED;
            let stateVal = this.getValue(this.channel, 'odp0000');

            if (stateVal == '2') {
                state = this.Characteristic.PositionState.INCREASING;
            } else if (stateVal == '3') {
                state = this.Characteristic.PositionState.DECREASING;
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
    },

    updateCharacteristics: function() {
        var that = this;

        this.getCurrentPosition(function(joker, value) {
            that.services.windowCovering.getCharacteristic(that.Characteristic.CurrentPosition).updateValue(value);
        });

        this.getTargetPosition(function(joker, value) {
            that.services.windowCovering.getCharacteristic(that.Characteristic.TargetPosition).updateValue(value);
        });

        this.getPositionState(function(joker, value) {
            that.services.windowCovering.getCharacteristic(that.Characteristic.PositionState).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerJalousieAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerJalousieAccessory;
