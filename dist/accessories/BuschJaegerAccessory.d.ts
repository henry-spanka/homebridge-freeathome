export function BuschJaegerAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null): void;
export class BuschJaegerAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null);
    platform: any;
    actuator: any;
    serial: any;
    typeId: any;
    channel: any;
    uuid_base: any;
    model: string;
    name: any;
    pendingUpdates: any[];
    mapping: any;
    services: {};
    Characteristic: any;
    hapService: any;
    interval: any;
    getServices: () => any[];
    getValue: (channelNo: any, datapoint: any) => any;
    setValue: (channelNo: any, datapoint: any, value?: null) => void;
    update: (channel: null | undefined, datapoint: any, value?: null) => void;
    removeChannelPrefix: (channel: any) => any;
    waitForUpdate: (callback: any, channel: any, datapoint: any, value?: null, timeout?: number) => void;
    processPendingUpdates: (channel: any, datapoint: any, value?: null, error?: boolean) => void;
    getChannelAttribute: (attribute: any) => any;
}
