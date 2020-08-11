/**
 * BuschJaegerAccessory
 */

var Service, Characteristic, BuschJaegerApPlatform;

function BuschJaegerAccessory(platform, Service, Characteristic, actuator, channel = null, mapping = null) {
    this.platform = platform;
    this.actuator = actuator;

    this.serial = actuator['serialNumber'];
    this.typeId = actuator['deviceId'];

    this.channel = channel ? this.removeChannelPrefix(channel) : null;

    if (this.channel) {
        this.uuid_base = this.serial + 'ch' + this.channel;
    } else {
        this.channel = '0000'
        this.uuid_base = this.serial;
    }

    this.model = actuator['typeName'] + ' (ch' + this.channel + ', ' + this.typeId + ')';
    this.name = this.getChannelAttribute("displayName");

    if (!this.name) {
        this.name = this.model
    }

    this.pendingUpdates = [];

    this.mapping = null;

    this.platform.log('initialising actuator ' + this.name + ' with uuid ' + this.uuid_base);

    this.services = {}

    this.Characteristic = Characteristic;
    this.hapService = Service;

    var informationService = new Service.AccessoryInformation();

    informationService
        .setCharacteristic(Characteristic.Manufacturer, "Busch-Jaeger")
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.services.information = informationService;

    if (this.platform.updateInterval && this.platform.updateInterval > 0) {
        this.interval = this.platform.updateInterval;
    }

}

BuschJaegerAccessory.prototype = {
    getServices: function() {
        return Object.keys(this.services).map(function(key) {
            return this.services[key];
        }.bind(this))
    },

    getValue: function(channelNo, datapoint) {
        let channel = 'ch' + channelNo;
        return this.platform.actuatorInfo[this.serial]['channels'][channel]['datapoints'][datapoint];
    },

    setValue: function(channelNo, datapoint, value = null) {
        let channel = 'ch' + channelNo;

        this.platform.setDatapoint(this.serial, channel, datapoint, value);
    },

    update: function(channel = null, datapoint, value = null) {
        this.platform.log('Updating accessory ' + this.name + ' with uuid ' + this.uuid_base);

        this.processPendingUpdates(channel, datapoint, value);

        this.updateCharacteristics();
    },

    removeChannelPrefix: function(channel) {
        return channel.replace('ch','');
    },

    waitForUpdate: function(callback, channel, datapoint, value = null, timeout = 5) {
        this.pendingUpdates.push({
            'channel': channel,
            'datapoint': datapoint,
            'value': value,
            'callback': callback,
            'persist': timeout == -1
        });

        if (timeout > 0) {
            setTimeout(() => {
                this.processPendingUpdates(channel, datapoint, value, true);
            }, timeout * 1000);
        }
    },

    processPendingUpdates: function(channel, datapoint, value = null, error = false) {
        for (let i = 0; i < this.pendingUpdates.length; i++) {
            let update = this.pendingUpdates[i];
            if ((update['channel'] && update['channel'] == channel) || (update['channel'] === null && channel === null)) {
                if (update['datapoint'] == datapoint) {
                    if (update['value'] === null) {
                        if (!update['persist']) {
                            this.pendingUpdates.splice(i, 1);
                        }

                        if (error) {
                            update['callback']("SysAp did not respond in time.");
                            this.platform.log("SysAp did not respond in time: " + [channel, datapoint, value].join('/'));
                            this.platform.log("If this issue persists please try to login as the API user in the free@home UI. The SysAp might disable websocket notifications if the connection is idle for too long.");
                            this.platform.log("See: https://github.com/henry-spanka/homebridge-buschjaeger#tips--tricks");
                        } else {
                            update['callback'](null, value);
                        }
                    } else if (update['value'] == value) {
                        if (!update['persist']) {
                            this.pendingUpdates.splice(i, 1);
                        }

                        if (error) {
                            update['callback']("SysAp did not respond in time.");
                            this.platform.log("SysAp did not respond in time: " + [channel, datapoint, value].join('/'));
                            this.platform.log("If this issue persists please try to login as the API user in the free@home UI. The SysAp might disable websocket notifications if the connection is idle for too long.");
                            this.platform.log("See: https://github.com/henry-spanka/homebridge-buschjaeger#tips--tricks");
                        } else {
                            update['callback'](null, value);
                        }
                    } else {
                        continue;
                    }
                }
            }
        }
    },

    getChannelAttribute: function(attribute) {
        if ('channels' in this.actuator && ("ch" + this.channel) in this.actuator['channels']) {
            return this.actuator['channels']["ch" + this.channel][attribute];
        } else {
            return undefined;
        }
    }

}

module.exports = {
    BuschJaegerAccessory: BuschJaegerAccessory
}
