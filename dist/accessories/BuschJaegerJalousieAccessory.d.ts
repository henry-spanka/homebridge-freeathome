export = BuschJaegerJalousieAccessory;
declare function BuschJaegerJalousieAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerJalousieAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    getCurrentPosition: (callback: any) => void;
    getTargetPosition: (callback: any) => void;
    setTargetPosition: (value: any, callback: any) => void;
    getPositionState: (callback: any) => void;
    setHoldPosition: (value: any, callback: any) => void;
    updateCharacteristics: () => void;
}
