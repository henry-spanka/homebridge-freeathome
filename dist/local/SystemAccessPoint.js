"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemAccessPoint = void 0;
const axios_1 = __importDefault(require("axios"));
const compare_versions_1 = __importDefault(require("compare-versions"));
const Logger_1 = require("freeathome-api/dist/lib/Logger");
const GuardedClient_1 = require("./GuardedClient");
const MessageBuilder_1 = require("./MessageBuilder");
const https = require('https');
class SystemAccessPoint {
    constructor(configuration, subscriber, logger) {
        this.online = false;
        this.keepAliveMessageId = 1;
        this.pingTimeoutSeconds = 10000;
        this.keepAliveTimer = null;
        this.pingTimeout = null;
        this.deviceData = {};
        this.subscribed = false;
        this.logger = new Logger_1.ConsoleLogger();
        this._protocol1 = 'wss://';
        this._protocol2 = 'https://';
        this._port = '';
        this._path2api = '/fhapi/v1/api';
        this._uuid = '00000000-0000-0000-0000-000000000000';
        this._minversionAP = '2.6.0';
        this.configuration = configuration;
        this.subscriber = subscriber;
        if (logger !== undefined && logger !== null) {
            this.logger = logger;
        }
        this.axios = axios_1.default.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
    }
    createClient() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = yield this.getSettings();
            let user;
            for (let tempUser of this.settings.users) {
                if (tempUser.name == this.configuration.username) {
                    user = tempUser;
                    break;
                }
            }
            if (user === undefined) {
                this.logger.error('The user does not exist in the System Access Point\'s configuration');
                throw new Error(`User ${this.configuration.username} does not exist`);
            }
            this.user = user;
            let username = user.jid.split('@')[0];
            this.client = new GuardedClient_1.GuardedClient(this.subscriber, {
                service: this._protocol1 + this.configuration.hostname + ((this._port != '') ? ':' + this._port : '') + this._path2api + '/ws',
                from: this.configuration.hostname,
                resource: 'freeathome-api',
                username: username,
                password: this.configuration.password
            }, this.logger);
            this.messageBuilder = new MessageBuilder_1.MessageBuilder(username);
            this.registerHandlers();
        });
    }
    getSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.axios.get(this._protocol2 + this.configuration.hostname + '/settings.json');
            if (response.status != 200) {
                this.logger.error("Unexpected status code from System Access Point while retrieving settings.json.");
                throw new Error("Unexpected status code from System Access Point while retrieving settings.json.");
            }
            if (!('flags' in response.data) || !('version' in response.data.flags)) {
                this.logger.error("Flags key does not exist in settings.json.");
                throw new Error("Flags key does not exist in settings.json.");
            }
            if (!('users' in response.data || !Array.isArray(response.data.users))) {
                this.logger.error("Users key does not exist in settings.json.");
                throw new Error("Users key does not exist in settings.json.");
            }
            return response.data;
        });
    }
    getDeviceConfiguration() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let _restpath = '/rest/configuration';
            let bwaToken = this.client.getBWAToken();
            try {
                let response = yield this.axios.get(this._protocol2 + this.configuration.hostname + this._path2api + _restpath, {
                    headers: { 'Authorization': 'Basic ' + bwaToken }
                });
                if (response.status != 200) {
                    this.logger.error("Unexpected status code from System Access Point while retrieving " + _restpath);
                    throw new Error("Unexpected status code from System Access Point while retrieving " + _restpath);
                }
                this._uuid = (_a = Object.keys(response.data)[0]) !== null && _a !== void 0 ? _a : this._uuid;
                this.deviceData = (_b = response.data[this._uuid]) === null || _b === void 0 ? void 0 : _b.devices;
                this.subscriber.broadcastMessage({ result: response.data, type: 'subscribed' });
                return response.data;
            }
            catch (e) {
                this.logger.error("Unexpected status code from System Access Point while retrieving " + _restpath + "\n" + e.toString());
                return null;
            }
        });
    }
    registerHandlers() {
        if (this.client === undefined) {
            throw new Error("Unknown error occurred! this.client undefined.");
        }
        this.client.on('error', err => {
            this.logger.error(err.toString());
            this.subscriber.broadcastMessage({
                type: "error",
                result: err
            });
        });
        this.client.on('close', () => {
            this.logger.log('Access Point has gone offline');
            this.online = false;
            this.subscribed = false;
            this.subscriber.broadcastMessage({
                'type': 'subscribed',
                'result': false
            });
            this.disableKeepAliveMessages();
        });
        this.client.guardedOn('message', (stanza) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.logger.debug('Received stanza:', JSON.parse(stanza));
            let astanza = (_a = JSON.parse(stanza)[this._uuid]) !== null && _a !== void 0 ? _a : null;
            this.heartBeat();
            if (astanza.datapoints) {
                this.handleEvent(astanza);
            }
        }));
        this.client.on('open', (address) => __awaiter(this, void 0, void 0, function* () {
            let connectedAs = 'Local API Websocket';
            this.logger.log("Connected as " + connectedAs);
            this.connectedAs = connectedAs;
            this.logger.log("Retrieving configuration...");
            let deviceData = this.getDeviceConfiguration();
        }));
        this.client.on('ping', ping => {
            this.heartBeat();
            this.logger.debug('WS Ping:', ping);
        });
        this.client.on('status', status => {
            this.logger.debug('Received new status:', status);
        });
        this.client.on('input', input => {
            this.logger.debug('Received new input data:', input);
        });
        this.client.on('output', output => {
            this.logger.debug('Received new output data:', output);
        });
    }
    heartBeat() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pingTimeout) {
                clearTimeout(this.pingTimeout);
            }
            let self = this;
            this.logger.debug("*** heartBeat " + this.pingTimeoutSeconds);
            this.pingTimeout = setTimeout(() => {
            }, this.pingTimeoutSeconds);
        });
    }
    handleEvent(stanza) {
        this.logger.debug("handleEvent: ");
        this.logger.debug(JSON.stringify(stanza));
        for (const [key, value] of Object.entries(stanza.datapoints)) {
            if (key) {
                let telegram = key + '/' + value;
                this.applyIncrementalUpdate(telegram.split('/'));
            }
        }
    }
    unwrapEventData(item) {
        return "";
    }
    sendMessage(message, value) {
        return __awaiter(this, void 0, void 0, function* () {
            let bwaToken = this.client.getBWAToken();
            try {
                let response = yield this.axios.put(this._protocol2 + this.configuration.hostname + this._path2api + '/rest/datapoint/' + this._uuid + '/' + message, value, {
                    headers: { 'Authorization': 'Basic ' + bwaToken }
                });
                if (response.status != 200) {
                    this.logger.error("Unexpected status code from System Access Point while PUT ");
                    throw new Error("Unexpected status code from System Access Point while PUT ");
                }
            }
            catch (e) {
                this.logger.error("Unexpected status code from System Access Point while PUT ");
            }
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createClient();
            if ((0, compare_versions_1.default)(this.settings.flags.version, this._minversionAP) < 0) {
                throw Error('Your System Access Point\'s firmware must be at least ' + this._minversionAP);
            }
            try {
                yield this.client.start();
                this.heartBeat();
            }
            catch (e) {
                this.logger.error('Could not connect to System Access Point', e.toString());
                throw Error("Could not connect to System Access Point");
            }
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log("Disconnecting from the System Access Point...");
            yield this.client.stop();
        });
    }
    sendKeepAliveMessage() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    sendKeepAliveMessages() {
        this.keepAliveTimer = setInterval(() => this.sendKeepAliveMessage(), 15000);
    }
    disableKeepAliveMessages() {
        if (this.keepAliveTimer !== null) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }
    applyIncrementalUpdate(update) {
        if (update == null || !(update instanceof Object)) {
            throw new Error("Invalid Incremental Update");
        }
        let upd = Array();
        if (update.length == 4) {
            const serialNo = update[0];
            const channelNo = update[1];
            const datapointNo = update[2];
            const value = update[3];
            upd[serialNo] = Array();
            if (!(serialNo in this.deviceData)) {
                this.deviceData[serialNo] = {
                    serialNumber: serialNo,
                    channels: {}
                };
            }
            else {
                upd[serialNo]['deviceId'] = this.deviceData[serialNo]['deviceId'];
                upd[serialNo]['typeName'] = this.deviceData[serialNo]['typeName'];
            }
            if (channelNo != null) {
                if (!(channelNo in this.deviceData[serialNo]['channels'])) {
                    this.deviceData[serialNo]['channels'][channelNo] = {
                        datapoints: {}
                    };
                }
                if (datapointNo != null) {
                    if (this.deviceData[serialNo]['channels'][channelNo]['datapoints'] != null) {
                        this.deviceData[serialNo]['channels'][channelNo]['datapoints'][datapointNo] = value;
                    }
                    else {
                        let channelKey = '';
                        if (this.deviceData[serialNo]['channels'][channelNo]['outputs'][datapointNo] != null) {
                            channelKey = 'outputs';
                        }
                        else if (this.deviceData[serialNo]['channels'][channelNo]['inputs'][datapointNo] != null) {
                            channelKey = 'inputs';
                        }
                        upd[serialNo]['channels'] = [];
                        upd[serialNo]['channels'][channelNo] = [];
                        upd[serialNo]['channels'][channelNo][channelKey] = [];
                        upd[serialNo]['channels'][channelNo][channelKey][datapointNo] = this.deviceData[serialNo]['channels'][channelNo][channelKey][datapointNo];
                        upd[serialNo]['channels'][channelNo][channelKey][datapointNo].value = value;
                    }
                    upd[serialNo]['serial'] = serialNo;
                    this.logger.debug("Updated Datapoint: " + serialNo + '/' + channelNo + '/' + datapointNo + '/' + value);
                }
                this.subscriber.broadcastMessage({ result: upd, type: 'update' });
            }
        }
    }
    setDatapoint(serialNo, channel, datapoint, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sendMessage(this.messageBuilder.buildSetDatapointMessage(serialNo, channel, datapoint, value), value);
            this.logger.log("Set Datapoint: " + serialNo + '/' + channel + '/' + datapoint + '/' + value);
        });
    }
    getDeviceData() {
        if (Object.entries(this.deviceData).length === 0 && this.deviceData.constructor === Object) {
            throw new Error("Device Data was requested before we have initialized it");
        }
        return this.deviceData;
    }
}
exports.SystemAccessPoint = SystemAccessPoint;
