"use strict";
var util = require("util");
var FFMPEG = require('./ffmpeg').FFMPEG;
var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;
function BuschJaegerVideoDoorBellAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerVideoDoorBellAccessory.super_.apply(this, arguments);
    this.Service = Service;
    this.videoProcessor = mapping['doorbell'][channel]['videoProcessor'] || 'ffmpeg';
    this.platform.log('exposing actuator ' + this.name + ' with uuid ' + this.uuid_base + ' as video doorbell');
    var name = mapping['doorbell'][channel]['name'];
    var uuid = this.platform.hap.uuid.generate(name);
    var videodoorbellAccessory = new this.platform.platformAccessory(name, uuid, this.platform.hap.Accessory.Categories.VIDEO_DOORBELL);
    var doorbellService = new Service.Doorbell(name);
    doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
        .on('get', function (callback) {
        callback(null, 0);
    });
    videodoorbellAccessory.addService(doorbellService);
    videodoorbellAccessory.on('identify', this.identify.bind(this, doorbellService));
    var cameraSource = new FFMPEG(this.platform.hap, mapping['doorbell'][channel], this.platform.log, this.videoProcessor);
    videodoorbellAccessory.configureCameraSource(cameraSource);
    this.hiddenServices = {};
    this.hiddenServices.videoDoorbell = videodoorbellAccessory;
    this.platform.hApi.publishCameraAccessories("homebridge-freeathome", [videodoorbellAccessory]);
    this.subscribeToBellEvent();
}
BuschJaegerVideoDoorBellAccessory.prototype = {
    identify: function (service, paired, callback) {
        this.platform.log("Identify requested!");
        service.getCharacteristic(this.Characteristic.ProgrammableSwitchEvent).setValue(0);
        callback();
    },
    getOn: function (callback) {
        if (callback) {
            let mode = parseInt(this.getValue(this.channel, 'idp0000')) ? true : false;
            callback(null, mode);
        }
    },
    setOn: function (value, callback) {
        if (this.getValue(this.channel, 'odp0000') != value) {
            if (value) {
                this.setValue(this.channel, 'idp0000', '1');
                this.waitForUpdate(callback, this.channel, 'odp0000', '1');
            }
            else {
                this.setValue(this.channel, 'idp0000', '0');
                this.waitForUpdate(callback, this.channel, 'odp0000', '0');
            }
        }
        else {
            this.platform.log('Accessory is already turned on/off');
            callback();
        }
    },
    subscribeToBellEvent: function () {
        this.waitForUpdate(function () {
            this.platform.log('Door Bell Rang');
            this.hiddenServices.videoDoorbell.getService(this.Service.Doorbell).getCharacteristic(this.Characteristic.ProgrammableSwitchEvent).setValue(0);
            this.setOn(0, function () {
            });
        }.bind(this), this.channel, 'odp0000', '1', -1);
    },
    updateCharacteristics: function () {
    }
};
util.inherits(BuschJaegerVideoDoorBellAccessory, BuschJaegerAccessory);
module.exports = BuschJaegerVideoDoorBellAccessory;
