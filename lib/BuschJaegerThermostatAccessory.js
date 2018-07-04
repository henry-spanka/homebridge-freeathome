"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerThermostatAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerThermostatAccessory.super_.apply(this, arguments);

    this.channel = '0000';

    var thermostatService = new Service.Thermostat();

    thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

    thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .setProps({
            validValues: [0, 3]
        })
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

    thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

    thermostatService.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
            maxValue: 35,
            minValue: 7,
            minStep: 0.5
        })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

    thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .setProps({
            validValues: [0]
        })
        .on('get', this.getTemperatureDisplayUnits.bind(this));

    /*
     * If we set TargetHeatingCoolingState to OFF the accessory will set the
     * target heating temperature to 35°C or 7°C. We will store the last target temperature
     * in this variable do prevent incorrect readouts. The real target temperature
     * is re-set correctly when the TargetHeatingCoolingState is set back to AUTO.
     */
    this.lastTargetTemperature = 0;

    this.services.thermostat = thermostatService;
}

BuschJaegerThermostatAccessory.prototype = {
    getCurrentHeatingCoolingState: function(callback) {
        if (callback) {
            let mode = this.Characteristic.CurrentHeatingCoolingState.HEAT;

            let valveOpen = parseInt(this.getValue(this.channel, 'odp0000'));

            if (valveOpen == 0) {
                mode = this.Characteristic.CurrentHeatingCoolingState.OFF;
            }

            callback(null, mode);
        }
    },
    getTargetHeatingCoolingState: function(callback) {
        if (callback) {
            let mode = this.Characteristic.TargetHeatingCoolingState.OFF;
            if (this.getValue(this.channel, 'odp0008') == '1') {
                mode = this.Characteristic.TargetHeatingCoolingState.AUTO
            }
            callback(null, mode);
        }
    },
    setTargetHeatingCoolingState: function(value, callback) {
        if (value == this.Characteristic.TargetHeatingCoolingState.OFF) {
            this.setValue(this.channel, 'idp0012', '0');
        } else {
            this.setValue(this.channel, 'idp0012', '1');
        }

        this.waitForUpdate(callback, this.channel, 'odp0008');
    },
    getCurrentTemperature: function(callback) {
        if (callback) {
            let temperature = Math.round(this.getValue(this.channel, 'odp0010'));
            callback(null, temperature);
        }
    },
    getTargetTemperature: function(callback) {
        this.getTargetHeatingCoolingState(function(joker, targetHeatingCoolingState) {
            let targetTemperature = Math.round(this.getValue(this.channel, 'odp0006'));

            // See param this.lastTargetTemperature for more information
            if (targetHeatingCoolingState != this.Characteristic.TargetHeatingCoolingState.OFF
              || (targetTemperature != 7 && targetTemperature != 35) || this.lastTargetTemperature == 0) {
                this.lastTargetTemperature = targetTemperature;
            }

            if (callback) {
                callback(null, this.lastTargetTemperature);
            }
        }.bind(this));
    },
    setTargetTemperature: function(value, callback) {
        this.getTargetHeatingCoolingState(function(joker, targetHeatingCoolingState) {
            // We first need to enable the Thermostat before we can set a new Temperature.
            if (targetHeatingCoolingState == this.Characteristic.TargetHeatingCoolingState.OFF) {
                this.setTargetHeatingCoolingState(this.Characteristic.TargetHeatingCoolingState.AUTO, function() {
                    this.setTargetTemperature(value, callback);
                }.bind(this));
            } else {
                this.setValue(this.channel, 'idp0016', value);

                this.waitForUpdate(callback, this.channel, 'odp0006');
            }
        }.bind(this));
    },
    getTemperatureDisplayUnits: function(callback) {
        if (callback) {
            callback(null, this.Characteristic.TemperatureDisplayUnits.CELSIUS);
        }
    },

    updateCharacteristics: function() {
        var that = this;

        this.getCurrentHeatingCoolingState(function(joker, value) {
            that.services.thermostat.getCharacteristic(that.Characteristic.CurrentHeatingCoolingState).updateValue(value);
        });
        this.getTargetHeatingCoolingState(function(joker, value) {
            that.services.thermostat.getCharacteristic(that.Characteristic.TargetHeatingCoolingState).updateValue(value);
            that.getTargetTemperature(function(joker, value) {
                that.services.thermostat.getCharacteristic(that.Characteristic.TargetTemperature).updateValue(value);
            });
        });
        this.getCurrentTemperature(function(joker, value) {
            that.services.thermostat.getCharacteristic(that.Characteristic.CurrentTemperature).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerThermostatAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerThermostatAccessory;
