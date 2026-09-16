declare module 'mic-recorder-to-mp3' {
  interface MicRecorderConfig {
    bitRate?: number;
    sampleRate?: number;
  }

  class MicRecorder {
    constructor(config?: MicRecorderConfig);
    start(): Promise<void>;
    stop(): {
      getMp3(): Promise<[string[], Blob]>;
    };
  }

  export default MicRecorder;
}
