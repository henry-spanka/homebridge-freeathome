"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerThermostatAccessory(platform, Service, Characteristic, actuator, channel = null) {
    BuschJaegerThermostatAccessory.super_.apply(this, arguments);

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
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

    thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .setProps({
            validValues: [0]
        })
        .on('get', this.getTemperatureDisplayUnits.bind(this));

    this.services.thermostat = thermostatService;

    this.autoUpdate();
}

BuschJaegerThermostatAccessory.prototype = {
    getCurrentHeatingCoolingState: function(callback) {
        if (callback) {
            let mode = this.Characteristic.CurrentHeatingCoolingState.HEAT;

            let targetTempDiff = this.getValue('0000', 'odp0007');
            if (targetTempDiff < 0) {
                mode = this.Characteristic.CurrentHeatingCoolingState.OFF;
            }
            callback(null, mode);
        }
    },
    getTargetHeatingCoolingState: function(callback) {
        if (callback) {
            let mode = this.Characteristic.TargetHeatingCoolingState.OFF;
            if (this.getValue('0000', 'odp0008') == '1') {
                mode = this.Characteristic.TargetHeatingCoolingState.AUTO
            }
            callback(null, mode);
        }
    },
    setTargetHeatingCoolingState: function(value, callback) {
        if (value == this.Characteristic.TargetHeatingCoolingState.OFF) {
            this.setValue('0000', 'idp0012', '0');
        } else {
            this.setValue('0000', 'idp0012', '1');
        }

        callback();
    },
    getCurrentTemperature: function(callback) {
        if (callback) {
            let temperature = parseFloat(this.getValue('0000', 'pm0002')) + parseFloat(this.getValue('0000', 'odp0007'));
            callback(null, temperature);
        }
    },
    getTargetTemperature: function(callback) {
        if (callback) {
            callback(null, parseFloat(this.getValue('0000', 'odp0006')));
        }
    },
    setTargetTemperature: function(value, callback) {
        this.setValue('0000', 'idp0016', value);

        callback();
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
        });
        this.getCurrentTemperature(function(joker, value) {
            that.services.thermostat.getCharacteristic(that.Characteristic.CurrentTemperature).updateValue(value);
        });
        this.getTargetTemperature(function(joker, value) {
            that.services.thermostat.getCharacteristic(that.Characteristic.TargetTemperature).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerThermostatAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerThermostatAccessory;
