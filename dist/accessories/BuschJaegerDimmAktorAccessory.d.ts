export = BuschJaegerDimmAktorAccessory;
declare function BuschJaegerDimmAktorAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerDimmAktorAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    getOn: (callback: any) => void;
    setOn: (value: any, callback: any) => void;
    getBrightness: (callback: any) => void;
    setBrightness: (value: any, callback: any) => void;
    updateCharacteristics: () => void;
}
