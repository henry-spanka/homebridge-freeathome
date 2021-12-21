export declare class MessageBuilder {
    constructor(username: string);
    private getMessageId;
    buildKeepAliveMessage(id: number): string;
    buildSetDatapointMessage(serialNo: string, channel: string, datapoint: string, value: string): string;
}
