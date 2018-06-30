"use strict";

var util = require("util");

var BuschJaegerAccessory = require('./BuschJaegerAccessory.js').BuschJaegerAccessory;


function BuschJaegerGarageDoorAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    BuschJaegerGarageDoorAccessory.super_.apply(this, arguments);

    this.storage = require('node-persist');

    this.storage.initSync({
        dir: "./.node-persist/storage"
    });

    this.movingUpTime = mapping['garagedoor'][channel]['movingUpTime'] || 15;
    this.movingDownTime = mapping['garagedoor'][channel]['movingDownTime'] || 15;

    this.platform.log('exposing actuator ' + this.name + ' with uuid ' + this.uuid_base + ' as garage door');

    var garageService = new Service.GarageDoorOpener();

    garageService.getCharacteristic(Characteristic.CurrentDoorState)
        .on('get', this.getCurrentDoorState.bind(this))
    garageService.getCharacteristic(Characteristic.TargetDoorState)
        .on('get', this.getTargetDoorState.bind(this))
        .on('set', this.setTargetDoorState.bind(this));
    garageService.getCharacteristic(Characteristic.ObstructionDetected)
        .on('get', this.getObstructionDetected.bind(this));

    this.ObstructionDetected = true;

    this.moving = false;

    this.services.garage = garageService;

    this.subscribeToMoveEvent();
}

BuschJaegerGarageDoorAccessory.prototype = {
    getCurrentDoorState: function(callback) {
        if (callback) {
            let state = this.getCurrentDoorStateFromStorage();
            if (state !== undefined) {
                this.ObstructionDetected = false;
            } else {
                // Assume the worst if we do not know the state.
                this.ObstructionDetected = true;
                state = this.Characteristic.CurrentDoorState.STOPPED;
            }

            callback(null, state);
        }
    },
    getTargetDoorState: function(callback) {
        if (callback) {
            let state = this.getTargetDoorStateFromStorage();
            if (state === undefined) {
                state = this.Characteristic.TargetDoorState.OPEN;
            }

            callback(null, state);
        }
    },
    setTargetDoorState: function(value, callback) {
        if (value == this.Characteristic.TargetDoorState.OPEN) {
            // Open Garage Door
            this.getCurrentDoorState(function(joker, state) {
                if (state == this.Characteristic.CurrentDoorState.OPEN) {
                    callback();
                } else {
                    this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.OPEN);
                    this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPENING);
                    this.moveGarageDoor(this.movingUpTime, function() {
                        this.platform.log('Garage Door should now be open');
                        this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPEN);
                        callback();
                    }.bind(this));
                }
            }.bind(this));
        } else if (value == this.Characteristic.TargetDoorState.CLOSED) {
            // Close Garage Door
            this.getCurrentDoorState(function(joker, state) {
                if (state == this.Characteristic.CurrentDoorState.CLOSED) {
                    callback();
                } else {
                    this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.CLOSED);
                    this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSING);
                    this.moveGarageDoor(this.movingDownTime, function() {
                        this.platform.log('Garage Door should now be closed');
                        this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSED);
                        callback();
                    }.bind(this));
                }
            }.bind(this));
        } else {
            // No change
            callback();
        }
    },
    moveGarageDoor: function(delay, callback) {
        this.setOn(true, function() {
            this.moving = true;
            setTimeout(function() {
                this.setOn(false, function() {
                    //
                });
            }.bind(this), 1000);

            setTimeout(callback, delay * 1000);
            setTimeout(function() {
                this.moving = false;
            }.bind(this), delay * 1000);
        }.bind(this));
    },
    getObstructionDetected: function(callback) {
        if (callback) {
            callback(null, this.ObstructionDetected);
        }
    },
    setOn: function(value, callback) {
        if (this.getValue(this.channel, 'idp0000') != value) {
            if (value) {
                this.setValue(this.channel, 'idp0000', '1');
                this.waitForUpdate(callback, this.channel, 'idp0000', '1');
            } else {
                this.setValue(this.channel, 'idp0000', '0');
                this.waitForUpdate(callback, this.channel, 'idp0000', '0');
            }
        } else {
            this.platform.log('Accessory is already turned on/off');
            callback();
        }
    },
    updateCharacteristics: function() {
        // Nothing to do here
    },
    getCurrentDoorStateFromStorage: function() {
        return this.storage.getItemSync('homebridge-buschjaeger-' + this.uuid_base + '-currentDoorState');
    },
    getTargetDoorStateFromStorage: function() {
        return this.storage.getItemSync('homebridge-buschjaeger-' + this.uuid_base + '-targetDoorState');
    },
    setCurrentDoorStateToStorage: function(value) {
        this.ObstructionDetected = false;
        this.services.garage.getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(value);
        this.storage.setItemSync('homebridge-buschjaeger-' + this.uuid_base + '-currentDoorState', value);
    },
    setTargetDoorStateToStorage: function(value) {
        this.services.garage.getCharacteristic(this.Characteristic.TargetDoorState).updateValue(value);
        this.storage.setItemSync('homebridge-buschjaeger-' + this.uuid_base + '-targetDoorState', value);
    },
    subscribeToMoveEvent: function() {
        this.waitForUpdate(function() {
            if (!this.moving) {
                this.platform.log('Moving Garage Door by external trigger');
                this.moving = true;
                this.getCurrentDoorState(function(joker, state) {
                    if (state == this.Characteristic.CurrentDoorState.OPEN) {
                        // Door is closing
                        this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.CLOSED);
                        this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSING);
                        setTimeout(function() {
                            this.platform.log('Garage Door should now be closed');
                            this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSED);
                            this.moving = false;
                            this.subscribeToMoveEvent();
                        }.bind(this), this.movingDownTime * 1000);
                    } else if (state == this.Characteristic.CurrentDoorState.CLOSED) {
                        // Door is opening
                        this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.OPEN);
                        this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPENING);
                        setTimeout(function() {
                            this.platform.log('Garage Door should now be open');
                            this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPEN);
                            this.moving = false;
                            this.subscribeToMoveEvent();
                        }.bind(this), this.movingUpTime * 1000);
                    } else {
                        this.platform.log('Invalid Door state - Not changing position');
                    }
                }.bind(this));

                setTimeout(function() {
                    this.setOn(false, function() {
                        //
                    });
                }.bind(this), 1000);
            } else {
                this.subscribeToMoveEvent();
            }
        }.bind(this), this.channel, 'odp0000', '1');
    },
}

util.inherits(BuschJaegerGarageDoorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerGarageDoorAccessory;
