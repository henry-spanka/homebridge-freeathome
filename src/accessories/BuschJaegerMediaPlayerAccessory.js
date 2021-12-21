"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerMediaPlayerAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerMediaPlayerAccessory.super_.apply(this, arguments);

    const uuid = this.platform.hap.uuid.generate("homebridge-freeathome:smart-speaker:" + this.uuid_base);
    const accessory = new this.platform.hApi.platformAccessory("SmartSpeaker", uuid);

   let speakerService = new platform.hap.Service.SmartSpeaker(this.name);

    speakerService
        .setCharacteristic(Characteristic.Mute, false);

    speakerService
        .setCharacteristic(this.Characteristic.ConfiguredName, this.name);

    speakerService.getCharacteristic(this.Characteristic.CurrentMediaState)
        .on('get', this.getCurrentMediaState.bind(this));
    speakerService.getCharacteristic(this.Characteristic.TargetMediaState)
        .on('get', this.getCurrentMediaState.bind(this))
        .on('set', this.setTargetMediaState.bind(this));
    speakerService.getCharacteristic(this.Characteristic.Volume)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));
        
    this.hiddenServices = {};
    this.hiddenServices.speaker = speakerService;

    this.services = {};

    accessory.addService(speakerService);
    accessory.category = 26;

    accessory.getService(this.hapService.AccessoryInformation)
        .setCharacteristic(this.Characteristic.Manufacturer, "Busch-Jaeger")
        .setCharacteristic(this.Characteristic.Model, this.model)
        .setCharacteristic(this.Characteristic.Name, this.name)
        .setCharacteristic(this.Characteristic.SerialNumber, this.serial);

    this.platform.hApi.publishExternalAccessories("homebridge-freeathome", [accessory]);
}

BuschJaegerMediaPlayerAccessory.prototype = {
    getCurrentMediaState: function(callback) {
        if (callback) {
            // free@home reports a value of 2 when two speaker zones are grouped but not currently playing
            // so we must do an explicit check.
            let status = parseInt(this.getValue(this.channel, 'odp0000')) == 1 ? this.Characteristic.CurrentMediaState.PLAY : this.Characteristic.CurrentMediaState.PAUSE;

            callback(null, status);
        }
    },
    setTargetMediaState: function(value, callback) {
        if (value == this.Characteristic.TargetMediaState.PLAY) {
            this.setValue(this.channel, 'idp0000', '1');
        } else {
            this.setValue(this.channel, 'idp0001', '1');
        }

        this.waitForUpdate(callback, this.channel, 'odp0000');
    },
    getVolume: function(callback) {
        if (callback) {
            callback(null, this.getValue(this.channel, 'odp0004'));
        }
    },
    setVolume: function(value, callback) {
        this.setValue(this.channel, 'idp0004', value);
        
        this.waitForUpdate(callback, this.channel, 'odp0004');
    },

    updateCharacteristics: function() {
        var that = this;

        this.getCurrentMediaState(function(joker, value) {
            that.hiddenServices.speaker.getCharacteristic(that.Characteristic.CurrentMediaState).updateValue(value);
            that.hiddenServices.speaker.getCharacteristic(that.Characteristic.TargetMediaState).updateValue(value);
        });

        this.getVolume(function(_, value) {
            that.hiddenServices.speaker.getCharacteristic(that.Characteristic.Volume).updateValue(value);
        });
    }
}

util.inherits(BuschJaegerMediaPlayerAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerMediaPlayerAccessory;
