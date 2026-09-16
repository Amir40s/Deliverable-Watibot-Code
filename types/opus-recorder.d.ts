declare module 'opus-recorder' {
  interface RecorderOptions {
    encoderPath?: string;
    encoderSampleRate?: number;
    numberOfChannels?: number;
    encoderApplication?: number;
    maxBuffersPerPage?: number;
    maxFramesPerPage?: number;
    encoderFrameSize?: number;
    streamPages?: boolean;
    leaveStreamOpen?: boolean;
    bufferLength?: number;
    resampleQuality?: number;
    encoderComplexity?: number;
    encoderBitRate?: number;
    sourceNode?: AudioNode;
  }

  export default class Recorder {
    constructor(options?: RecorderOptions);
    start(): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
    close(): void;
    ondataavailable: (data: Uint8Array) => void;
    onstart?: () => void;
    onstop?: () => void;
    onpause?: () => void;
    onresume?: () => void;
    static isRecordingSupported(): boolean;
  }
}
