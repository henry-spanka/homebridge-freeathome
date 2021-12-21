export = BuschJaegerDoorBellAccessory;
declare function BuschJaegerDoorBellAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerDoorBellAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    getOn: (callback: any) => void;
    setOn: (value: any, callback: any) => void;
    updateCharacteristics: () => void;
}
