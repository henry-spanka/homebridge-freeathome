"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBuilder = void 0;
class MessageBuilder {
    constructor(username) {
    }
    getMessageId() {
        return -1;
    }
    buildKeepAliveMessage(id) {
        return "ping";
    }
    buildSetDatapointMessage(serialNo, channel, datapoint, value) {
        return serialNo + "." + channel + "." + datapoint;
    }
}
exports.MessageBuilder = MessageBuilder;
