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

    this.slats = {
        horizontal: false
    };

    // Check if this is a shutter which has fuctionId 0x9
    if (this.getChannelAttribute('functionId') == '9') {
        // only support horizontal for now.
        this.slats.horizontal = true;

        windowCoveringService.setCharacteristic(Characteristic.CurrentSlatState, Characteristic.CurrentSlatState.FIXED);
        windowCoveringService.setCharacteristic(Characteristic.SlatType, Characteristic.SlatType.HORIZONTAL);
        windowCoveringService.getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
            .on('get', this.getCurrentHorizontalTiltAngle.bind(this));
        windowCoveringService.getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
            .setProps({
                maxValue: 0
            })
            .on('get', this.getTargetHorizontalTiltAngle.bind(this))
            .on('set', this.setTargetHorizontalTiltAngle.bind(this));

        this.platform.log('Enabling Horizontal Slats Support for ' + this.name + '.');
    }

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
            let positionState = this.getValue(this.channel, 'odp0000');

            // If shutter is manually controlled using a switch then the target position is not updated.
            // Refs https://github.com/henry-spanka/homebridge-buschjaeger/issues/17
            if (targetPos === undefined || positionState == '0' || positionState == '1') {
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
            this.waitForUpdate(callback, this.channel, 'odp0000', null, 30);
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

    /* For horizontal slats, a value of -90 indicates the slats should be fully closed and rotated
     * such that the user-facing edge is higher than the opposing edge. For vertical slats, this
     * value indicates that the user-facing edge should be to the left of the opposing edge.
     * In either case, a value of 0 indicates that the edges should be aligned, with the slats fully open.
     * 
     * https://developer.apple.com/documentation/homekit/hmcharacteristictypetargettilt
     */

    getCurrentHorizontalTiltAngle: function(callback) {
        if (this.slats.horizontal && callback) {
            // angle between -90 and +90.
            let percentage = parseInt(this.getValue(this.channel, 'odp0002'));

            callback(null, Math.round((-90) * (percentage / 100)));
        }
    },

    getTargetHorizontalTiltAngle: function(callback) {
        if (this.slats.horizontal && callback) {
            // angle between -90 and +90.
            let percentage = parseInt(this.getValue(this.channel, 'idp0003'));

            callback(null, Math.round((-90) * (percentage / 100)));
        }
    },

    setTargetHorizontalTiltAngle: function(value, callback) {
        if (this.slats.horizontal && callback) {
            let currentAngle = Math.round((-90) * (parseInt(this.getValue(this.channel, 'odp0002')) / 100));
            let targetPosition = Math.round(Math.abs((value / 90) * 100));
    
            this.platform.log('Jalousie '+ this.uuid_base + ' Tilt Angle ' + currentAngle + ' -> ' + value);
    
            if (value != currentAngle) {
                this.setValue(this.channel, 'idp0003', targetPosition);
                this.waitForUpdate(callback, this.channel, 'odp0002', null, 30);
            } else {
                // No Change
                callback();
                return;
            }
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

        if (this.slats.horizontal) {
            this.getCurrentHorizontalTiltAngle(function(_, value) {
                that.services.windowCovering.getCharacteristic(that.Characteristic.CurrentHorizontalTiltAngle).updateValue(value);
            });

            this.getTargetHorizontalTiltAngle(function(_, value) {
                that.services.windowCovering.getCharacteristic(that.Characteristic.TargetHorizontalTiltAngle).updateValue(value);
            });
        }
    }
}

util.inherits(BuschJaegerJalousieAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerJalousieAccessory;
