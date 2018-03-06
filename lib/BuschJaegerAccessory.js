/**
 * BuschJaegerAccessory
 */

var Service, Characteristic, BuschJaegerApPlatform;

function BuschJaegerAccessory(platform, Service, Characteristic, actuator) {
    this.platform = platform;
    this.actuator = actuator;

    this.serial = actuator['serialNumber'];
    this.typeId = actuator['deviceId'];
    this.name = actuator['typeName'];

    this.uuid_base = this.serial;

    this.platform.log('initialising actuator ' + this.name + ' with serial ' + this.serial);

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
    },

    autoUpdate: function() {
        setInterval(this.update.bind(this), this.interval * 1000);
    },

    update: function() {
        this.platform.log('Updating accessory ' + this.name + ' with serial ' + this.serial);

        this.updateCharacteristics();
    }

}

module.exports = {
    BuschJaegerAccessory: BuschJaegerAccessory
}
