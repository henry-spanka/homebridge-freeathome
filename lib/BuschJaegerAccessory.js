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

        let message = ['raw', this.serial, channel, datapoint, value].join('/');

        this.platform.send(message);
        this.platform.log(message);
        this.platform.update();
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
                if (update['channel'] == channel && update['datapoint'] == datapoint) {
                    if (update['value'] === null) {
                        if (!update['persist']) {
                            this.pendingUpdates.splice(i, 1);
                        }

                        if (error) {
                            update['callback']("SysAp did not respond in time.");
                        } else {
                            update['callback'](null, value);
                        }
                    } else if (update['value'] == value) {
                        if (!update['persist']) {
                            this.pendingUpdates.splice(i, 1);
                        }

                        if (error) {
                            update['callback']("SysAp did not respond in time.");
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
        return this.actuator['channels'][this.channel][attribute];
    }

}

module.exports = {
    BuschJaegerAccessory: BuschJaegerAccessory
}
