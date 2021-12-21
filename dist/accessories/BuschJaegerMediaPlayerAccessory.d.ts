export = BuschJaegerMediaPlayerAccessory;
declare function BuschJaegerMediaPlayerAccessory(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]): void;
declare class BuschJaegerMediaPlayerAccessory {
    constructor(platform: any, Service: any, Characteristic: any, actuator: any, channel?: null, mapping?: null, ...args: any[]);
    hiddenServices: {};
    services: {};
    getCurrentMediaState: (callback: any) => void;
    setTargetMediaState: (value: any, callback: any) => void;
    getVolume: (callback: any) => void;
    setVolume: (value: any, callback: any) => void;
    updateCharacteristics: () => void;
}
