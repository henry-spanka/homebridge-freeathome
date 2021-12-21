export = BuschJaegerVideoDoorBellAccessory;
declare function BuschJaegerVideoDoorBellAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerVideoDoorBellAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    Service: any;
    videoProcessor: any;
    hiddenServices: {};
    identify: (service: any, paired: any, callback: any) => void;
    getOn: (callback: any) => void;
    setOn: (value: any, callback: any) => void;
    subscribeToBellEvent: () => void;
    updateCharacteristics: () => void;
}
