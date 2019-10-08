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
    this.triggerTime = mapping['garagedoor'][channel]['triggerTime'] || 1 ;

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

    this.moveCallback = null;
    this.rawMoveCallback = null;

    this.disabledEventProcessing = false;

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
        this.moveGarageDoor(value, callback);
    },
    getObstructionDetected: function(callback) {
        if (callback) {
            callback(null, this.ObstructionDetected);
        }
    },
    getOn: function(callback) {
        if (callback) {
            let mode = parseInt(this.getValue(this.channel, 'idp0000')) ? true : false;
            callback(null, mode);
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
    triggerDoor: function(callback) {
        this.getOn(function(joker, mode) {
            if (mode) {
                setTimeout(function() {
                    this.setOn(false, function() {
                        callback();
                    });
                }.bind(this), this.triggerTime * 1000);
            } else {
                this.disabledEventProcessing = true;
                this.setOn(true, function() {
                    setTimeout(function() {
                        this.setOn(false, function() {
                            this.disabledEventProcessing = false;
                            callback();
                        }.bind(this));
                    }.bind(this), this.triggerTime * 1000);
                }.bind(this));
            }
        }.bind(this));
    },
    openOperation: function(callback = null) {
        this.platform.log('Opening Garage Door');
        // Open
        this.triggerDoor(function() {
            this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.OPEN);
            this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPENING);

            this.moveCallback = setTimeout(function() {
                this.platform.log('Garage Door should now be open');
                this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.OPEN);
                if (callback !== null) {
                    callback();
                }
            }.bind(this), this.movingUpTime * 1000);
            this.rawMoveCallback = callback;
        }.bind(this));
    },
    closeOperation: function(callback = null) {
        // Close
        this.platform.log('Closing Garage Door');
        this.triggerDoor(function() {
            this.setTargetDoorStateToStorage(this.Characteristic.TargetDoorState.CLOSED);
            this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSING);

            this.moveCallback = setTimeout(function() {
                this.platform.log('Garage Door should now be closed');
                this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.CLOSED);
                if (callback !== null) {
                    callback();
                }
            }.bind(this), this.movingDownTime * 1000);
            this.rawMoveCallback = callback;
        }.bind(this));
    },
    stopOperation: function(callback = null) {
        // Stop
        this.platform.log('Stopping Garage Door');
        this.triggerDoor(function() {
            if (this.moveCallback !== null) {
                clearTimeout(this.moveCallback);
                this.moveCallback = null;
            }
            if (this.rawMoveCallback !== null) {
                this.rawMoveCallback();
                this.rawMoveCallback = null;
            }
            this.platform.log('Stopped Garage Door');
            this.setCurrentDoorStateToStorage(this.Characteristic.CurrentDoorState.STOPPED);
            if (callback !== null) {
                callback();
            }
        }.bind(this));
    },
    /**
     * @param {boolean} force - Indicates that the Garage door should
     * never stop and always be either in a closed or open state. It
     * is generally only set if the request is sent by HomeKit.
     * @callback callback - Called at the end of the move operation.
     */
    moveGarageDoor: function(force = null, callback = null) {
        this.getCurrentDoorState(function(joker, currentState) {
            this.getTargetDoorState(function(joker1, targetState) {
                switch (currentState) {
                    case this.Characteristic.CurrentDoorState.OPEN:
                        if (force != this.Characteristic.TargetDoorState.OPEN) {
                            this.closeOperation(callback);
                        }
                        break;
                    case this.Characteristic.CurrentDoorState.CLOSED:
                        if (force != this.Characteristic.TargetDoorState.CLOSED) {
                            this.openOperation(callback);
                        }
                        break;
                    case this.Characteristic.CurrentDoorState.OPENING:
                        if (force != this.Characteristic.TargetDoorState.CLOSED) {
                            this.stopOperation(callback);
                        } else {
                            this.closeOperation(callback);
                        }
                        break;
                    case this.Characteristic.CurrentDoorState.CLOSING:
                        if (force != this.Characteristic.TargetDoorState.OPEN) {
                            this.stopOperation(callback);
                        } else {
                            this.openOperation(callback);
                        }
                        break;
                    case this.Characteristic.CurrentDoorState.STOPPED:
                        if (force !== null) {
                            if (force == this.Characteristic.TargetDoorState.OPEN) {
                                // Open
                                this.openOperation(callback);
                            } else if (force == this.Characteristic.TargetDoorState.CLOSED) {
                                // Close
                                this.closeOperation(callback);
                            } else {
                                this.platform.log('Unexpected Door State');
                            }
                        } else {
                            switch (targetState) {
                                case this.Characteristic.TargetDoorState.OPEN:
                                    this.closeOperation(callback);
                                    break;
                                case this.Characteristic.TargetDoorState.CLOSED:
                                    this.openOperation(callback);
                                    break;
                                default:
                                    this.platform.log('Unexpected Door State');
                                    break;
                            }
                        }
                        break;

                    default:
                        // Should not happen
                        this.platform.log('Unexpected Door State');
                        break;
                }
            }.bind(this));
        }.bind(this));
    },
    subscribeToMoveEvent: function() {
        this.waitForUpdate(function() {
            if (!this.disabledEventProcessing) {
                this.platform.log('Received event to move Garage Door');
                this.moveGarageDoor();
            }

            // Wait 2s before processing another switch press event
            setTimeout(this.subscribeToMoveEvent.bind(this), 2000);
        }.bind(this), this.channel, 'odp0000', '1', 0);
    },
}

util.inherits(BuschJaegerGarageDoorAccessory, BuschJaegerAccessory);

module.exports = BuschJaegerGarageDoorAccessory;
