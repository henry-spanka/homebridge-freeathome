export function FFMPEG(hap: any, cameraConfig: any, log: any, videoProcessor: any): void;
export class FFMPEG {
    constructor(hap: any, cameraConfig: any, log: any, videoProcessor: any);
    log: any;
    name: any;
    vcodec: any;
    videoProcessor: any;
    audio: any;
    acodec: any;
    packetsize: any;
    fps: any;
    maxBitrate: any;
    debug: any;
    additionalCommandline: any;
    ffmpegSource: any;
    ffmpegImageSource: any;
    services: any[];
    streamControllers: any[];
    pendingSessions: {};
    ongoingSessions: {};
    maxWidth: any;
    maxHeight: any;
    handleCloseConnection(connectionID: any): void;
    handleSnapshotRequest(request: any, callback: any): void;
    prepareStream(request: any, callback: any): void;
    handleStreamRequest(request: any): void;
    createCameraControlService(): void;
    _createStreamControllers(maxStreams: any, options: any): void;
}
