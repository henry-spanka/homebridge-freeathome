export = BuschJaegerDoorLockAccessory;
declare function BuschJaegerDoorLockAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerDoorLockAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    getCurrentLockState: (callback: any) => void;
    getTargetLockState: (callback: any) => void;
    setTargetLockState: (value: any, callback: any) => void;
    updateCharacteristics: () => void;
}
