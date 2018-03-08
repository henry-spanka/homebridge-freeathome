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
        this.name = actuator['typeName'] + ' Channel ' + this.channel;
        this.uuid_base = this.serial + 'ch' + this.channel;
    } else {
        this.name = actuator['typeName'];
        this.uuid_base = this.serial;
    }

    this.mapping = null;

    this.platform.log('initialising actuator ' + this.name + ' with uuid ' + this.uuid_base);

    this.services = {}

    this.Characteristic = Characteristic;

    var informationService = new Service.AccessoryInformation();

    informationService
        .setCharacteristic(Characteristic.Manufacturer, "BuschJaeger")
        .setCharacteristic(Characteristic.Model, this.name + ' / ' + this.typeId)
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.services.information = informationService;

    let interval = 10;

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

        this.platform.ws.send(message);
        this.platform.log(message);
        this.platform.update();
    },

    autoUpdate: function() {
        this.platform.subscribe(this.update.bind(this));
    },
    updateNow: function(callback = null) {
        this.platform.log('Forcing update of accessory ' + this.name + ' with uuid ' + this.uuid_base);

        if (callback) {
            this.platform.subscribeOneTime(callback);
        }

        this.platform.update();
    },

    update: function() {
        this.platform.log('Updating accessory ' + this.name + ' with uuid ' + this.uuid_base);

        this.updateCharacteristics();
    },

    removeChannelPrefix: function(channel) {
        return channel.replace('ch','');
    }

}

module.exports = {
    BuschJaegerAccessory: BuschJaegerAccessory
}
