import React from 'react';

import { NativeModules, PermissionsAndroid, Platform, NativeEventEmitter } from 'react-native';

const AudioRecorderManager = NativeModules.AudioRecorderManager;
const AudioRecorderEventEmitter = new NativeEventEmitter(AudioRecorderManager);

const AudioUtils = Object.freeze({
  MainBundlePath: AudioRecorderManager.MainBundlePath,
  CachesDirectoryPath: AudioRecorderManager.CachesDirectoryPath,
  DocumentDirectoryPath: AudioRecorderManager.DocumentDirectoryPath,
  LibraryDirectoryPath: AudioRecorderManager.LibraryDirectoryPath,
  PicturesDirectoryPathAndroid:
    Platform.OS === 'android' ? AudioRecorderManager.PicturesDirectoryPath : '',
  MusicDirectoryPathAndroid:
    Platform.OS === 'android' ? AudioRecorderManager.MusicDirectoryPath : '',
  DownloadsDirectoryPathAndroid:
    Platform.OS === 'android' ? AudioRecorderManager.DownloadsDirectoryPath : '',
});

const AudioSourceAndroid = Object.freeze({
  DEFAULT: 0,
  MIC: 1,
  VOICE_UPLINK: 2,
  VOICE_DOWNLINK: 3,
  VOICE_CALL: 4,
  CAMCORDER: 5,
  VOICE_RECOGNITION: 6,
  VOICE_COMMUNICATION: 7,
  REMOTE_SUBMIX: 8, // added in API 19
  UNPROCESSED: 9, // added in API 24
});

const AudioQualityIOS = Object.freeze(
  Platform.OS === 'ios'
    ? {
        LOW: AudioRecorderManager.AudioLowQuality,
        MEDIUM: AudioRecorderManager.AudioMediumQuality,
        HIGH: AudioRecorderManager.AudioHighQuality,
      }
    : {}
);

const AudioEncodingAndroid = Object.freeze(
  Platform.OS === 'android'
    ? {
        AAC: AudioRecorderManager.AacAudioEncoding,
        AAC_ELD: AudioRecorderManager.AacEldAudioEncoding,
        AMR_NB: AudioRecorderManager.AmrNbAudioEncoding,
        AMR_WB: AudioRecorderManager.AmrWbAudioEncoding,
        HE_AAC: AudioRecorderManager.HeAacAudioEncoding,
        VORBIS: AudioRecorderManager.VorbisAudioEncoding,
      }
    : {}
);

const AudioEncodingIOS = Object.freeze(
  Platform.OS === 'ios'
    ? {
        LPCM: AudioRecorderManager.LpcmAudioEncoding,
        IMA4: AudioRecorderManager.Ima4AudioEncoding,
        AAC: AudioRecorderManager.AacAudioEncoding,
        MACE3: AudioRecorderManager.Mac3AudioEncoding,
        MACE6: AudioRecorderManager.Mac6AudioEncoding,
        ULAW: AudioRecorderManager.UlawAudioEncoding,
        ALAW: AudioRecorderManager.AlawAudioEncoding,
        MP1: AudioRecorderManager.Mp1AudioEncoding,
        MP2: AudioRecorderManager.Mp2AudioEncoding,
        ALAC: AudioRecorderManager.AlacAudioEncoding,
        AMR: AudioRecorderManager.AmrAudioEncoding,
        FLAC: AudioRecorderManager.FlacAudioEncoding,
        OPUS: AudioRecorderManager.OpusAudioEncoding,
      }
    : {}
);

const AudioOuputFormatAndroid = Object.freeze(
  Platform.OS === 'android'
    ? {
        MPEG_4: AudioRecorderManager.Mpeg4AudioOutputFormat,
        AAC_ADTS: AudioRecorderManager.AacAdtsAudioOutputFormat,
        AMR_NB: AudioRecorderManager.AmrNbAudioOutputFormat,
        AMR_WB: AudioRecorderManager.AmrWbAudioOutputFormat,
        THREE_GPP: AudioRecorderManager.ThreeGppAudioOutputFormat,
        WEBM: AudioRecorderManager.WebmAudioOutputFormat,
        MPEG_2_TS: AudioRecorderManager.Mpeg2TsAudioOutputFormat,
      }
    : {}
);

const AudioError = Object.freeze({
  RecorderIsPreparing: 'RECORDER_IS_PREPARING',
  InvalidState: AudioRecorderManager.InvalidState,
  FailedToConfigureRecorder: AudioRecorderManager.FailedToConfigureRecorder,
  FailedToPrepareRecorder: AudioRecorderManager.FailedToPrepareRecorder,
  RecorderNotPrepared: AudioRecorderManager.RecorderNotPrepared,
  NoRecordDataFound: AudioRecorderManager.NoRecordDataFound,
  NoAccessToWriteToDirectory: AudioRecorderManager.NoAccessToWriteToDirectory,
  AlreadyRecording:
    Platform.OS === 'android' ? AudioRecorderManager.AlreadyRecording : 'ALREADY_RECORDING_ERROR',
  MethodNotAvailable:
    Platform.OS === 'android'
      ? AudioRecorderManager.MethodNotAvailable
      : 'METHOD_NOT_AVAILABLE_ERROR',
  ReactContextNotInitialized:
    Platform.OS === 'android'
      ? AudioRecorderManager.ReactContextNotInitialized
      : 'REACT_CONTEXT_NOT_INITIALIZED',
  RecorderServerDied:
    Platform.OS === 'android' ? AudioRecorderManager.RecorderServerDied : 'RECORDER_SERVER_DIED',
  UnknownError:
    Platform.OS === 'android' ? AudioRecorderManager.UnknownError : 'RECORDER_UNKNOWN_ERROR',
  FailedToEncodeAudio:
    Platform.OS === 'ios' ? AudioRecorderManager.FailedToEncodeAudio : 'AUDIO_ENCODING_ERROR',
});

const AudioEvent = Object.freeze({
  Progress: 'recordingProgress',
  Finished: 'recordingFinished',
  Error: 'recordingError',
});

const AudioState = Object.freeze({
  Initial: 0,
  Prepared: 1,
  Recording: 2,
  Paused: 3,
});

const AudioDefaultConfig = Object.freeze({
  SampleRate: 44100,
  Channels: 2,
  AudioQuality: AudioQualityIOS.HIGH ?? 'High',
  AudioEncoding: Platform.OS === 'ios' ? AudioEncodingIOS.AAC : AudioEncodingAndroid.AAC,
  OutputFormat: AudioOuputFormatAndroid.AAC_ADTS ?? 'aac_adts',
  MeteringEnabled: false,
  ProgressUpdateInterval: 1000,
  MeasurementMode: false,
  AudioEncodingBitRate: 128000,
  IncludeBase64: false,
  AudioSource: 1, // MIC
  MaxDuration: 0, // MilliSeconds
});

const buildRejectError = (code, message) => ({ code, message });

class AudioRecorder {
  constructor() {
    this.config = { ...AudioDefaultConfig };
    this._state = AudioState.Initial;
    this.lastPreparedPath = null;
    this.progressSubscription = AudioRecorderEventEmitter.addListener(
      AudioEvent.Progress,
      this.recordingData.bind(this)
    )
    this.errorSubscription = AudioRecorderEventEmitter.addListener(
      AudioEvent.Error,
      this._onError.bind(this)
    );
    this.finishSubscription = AudioRecorderEventEmitter.addListener(
      AudioEvent.Finished,
      this._onFinished.bind(this)
    );
    this.lastPreparingPath = null;
  }

  /** @param {Partial<typeof AudioDefaultConfig>?} config */
  setConfig = (config = {}) => {
    this.config = { ...AudioDefaultConfig, ...config };
  };

  get state() {
    return this._state;
  }

  static addListener(event, listener) {
    return AudioRecorderEventEmitter.addListener(event, listener);
  }

  static removeListener(subscription) {
    AudioRecorderEventEmitter.removeSubscription(subscription);
  }

  /**
   * Errors:
   * - InvalidState
   * - NoAccessToWriteToDirectory
   * - FailedToConfigureRecorder
   * - FailedToPrepareRecorder
   */
  prepareAtPath = (path) => {
    if (this.state === AudioState.Prepared && this.lastPreparedPath === path) {
      return Promise.resolve(path);
    }

    if (this.state !== AudioState.Initial) {
      return Promise.reject(
        buildRejectError(
          AudioError.InvalidState,
          'Stop previous recording before starting preparing'
        )
      );
    }

    if (this.lastPreparingPath) {
      return Promise.reject(
        buildRejectError(
          AudioError.RecorderIsPreparing,
          `Recorder is already preparing with path ${this.lastPreparingPath}`
        )
      );
    }

    this.lastPreparingPath = path;

    return new Promise((resolve, reject) => {
      AudioRecorderManager.prepareRecordingAtPath(path, this.config)
        .then((outputPath) => {
          this._state = AudioState.Prepared;
          this.lastPreparedPath = outputPath;
          this.lastPreparingPath = null;
          resolve(outputPath);
        })
        .catch((error) => {
          this.lastPreparingPath = null;
          reject(error);
        });
    });
  };

  /**
   * Errors:
   * - InvalidState
   * - AlreadyRecording
   * - RecorderNotPreparedError
   */
  start = () => {
    return new Promise((resolve, reject) => {
      if (this.state < AudioState.Prepared) {
        reject(
          buildRejectError(
            AudioError.RecorderNotPrepared,
            'Prepare recorder before starting recording'
          )
        );

        return;
      }

      if (this.state > AudioState.Prepared) {
        reject(
          buildRejectError(
            AudioError.InvalidState,
            'Stop previous recording before starting new record'
          )
        );

        return;
      }

      AudioRecorderManager.startRecording()
        .then((path) => {
          this._state = AudioState.Recording;
          resolve(path);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /**
   * Errors:
   * - MethodNotAvailableErrorAndroid
   * - InvalidStateError
   */
  pause = () => {
    return new Promise((resolve, reject) => {
      if (this.state === AudioState.Paused) {
        resolve();
        return;
      }

      if (this.state !== AudioState.Recording) {
        reject(
          buildRejectError(
            AudioError.InvalidState,
            'Prepare and start recording before pausing record'
          )
        );

        return;
      }

      AudioRecorderManager.pauseRecording()
        .then(() => {
          this._state = AudioState.Paused;
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /**
   * Errors:
   * - MethodNotAvailableErrorAndroid
   * - InvalidStateError
   */
  resume = () => {
    return new Promise((resolve, reject) => {
      if (this.state === AudioState.Recording) {
        resolve();
        return;
      }

      if (this.state !== AudioState.Paused) {
        reject(
          buildRejectError(
            AudioError.InvalidState,
            'Prepare and start recording before resuming record'
          )
        );

        return;
      }

      AudioRecorderManager.resumeRecording()
        .then(() => {
          this._state = AudioState.Recording;
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  /**
   * Errors:
   * - InvalidStateError
   * - NoRecordDataFoundError
   */
  stop = () => {
    return new Promise((resolve, reject) => {
      if (this.state < AudioState.Recording) {
        reject(
          buildRejectError(
            AudioError.InvalidState,
            'Prepare and start recording before stopping record'
          )
        );

        return;
      }

      AudioRecorderManager.stopRecording()
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  destroy = () => {
    return new Promise((resolve, reject) => {
      AudioRecorderManager.destroy()
        .then(() => {
          this._reset();
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // progressSubscription = (data) => {
  //   return data
  // }

  clean = () => {
    AudioRecorderEventEmitter.removeSubscription(this.progressSubscription)
    AudioRecorderEventEmitter.removeSubscription(this.errorSubscription);
    AudioRecorderEventEmitter.removeSubscription(this.finishSubscription);
    return this.destroy();
  };

  checkAuthorizationStatus = () => {
    return AudioRecorderManager.checkAuthorizationStatus();
  };

  requestAuthorization = () => {
    if (Platform.OS === 'ios') {
      return AudioRecorderManager.requestAuthorization();
    } else {
      return new Promise((resolve, reject) => {
        PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
          .then((result) => {
            if (result === PermissionsAndroid.RESULTS.GRANTED) {
              resolve(true);
            } else {
              resolve(false);
            }
          })
          .catch((error) => {
            reject(error);
          });
      });
    }
  };

  recordingData = data => {
    // console.log(data)
    return data
  }

  _reset = () => {
    this._state = AudioState.Initial;
    this.lastPreparedPath = null;
    this.lastPreparingPath = null;
  };

  _onError(error) {
    if (error.path !== this.lastPreparedPath) {
      // unrelated error so ignore it
      return;
    }

    this._reset();
  }

  _onFinished(data) {
    if (data.path !== this.lastPreparedPath) {
      // unrelated event so ignore it
      return;
    }

    this._reset();
  }
}

export {
  AudioRecorder,
  AudioUtils,
  AudioQualityIOS,
  AudioSourceAndroid,
  AudioEncodingIOS,
  AudioEncodingAndroid,
  AudioError,
  AudioEvent,
  AudioState,
};
