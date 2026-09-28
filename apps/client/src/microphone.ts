export type MorokMicrophoneState =
  | "starting"
  | "live"
  | "blocked"
  | "unsupported";

type Listener = (state: MorokMicrophoneState) => void;
type TranscriptListener = (text: string) => void;

type SpeechRecognitionConstructor = new () => any;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

class MorokMicrophoneController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private recognition: any = null;
  private recognitionStarting = false;
  private retryTimer: number | null = null;
  private stopTimer: number | null = null;
  private retryAttempt = 0;
  private blocked = false;
  private wanted = false;
  private manualRequested = false;
  private listeners = new Set<Listener>();
  private transcriptListeners = new Set<TranscriptListener>();

  subscribe(onState: Listener, onTranscript: TranscriptListener) {
    this.listeners.add(onState);
    this.transcriptListeners.add(onTranscript);
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.wanted = true;
    onState(this.currentState());
    void this.ensureStarted();

    return () => {
      this.listeners.delete(onState);
      this.transcriptListeners.delete(onTranscript);
      if (this.listeners.size === 0) {
        this.wanted = false;
        this.scheduleStop();
      }
    };
  }

  manual() {
    this.manualRequested = true;
    this.wanted = true;
    void this.ensureStarted();
    if (this.stream && !this.recognition && !this.recognitionStarting) {
      this.startRecognition();
    }
  }

  private currentState(): MorokMicrophoneState {
    if (!this.isSpeechRecognitionSupported()) return "unsupported";
    if (this.blocked) return "blocked";
    if (this.track?.readyState === "live") return "live";
    return "starting";
  }

  private emit() {
    const state = this.currentState();
    this.listeners.forEach(listener => listener(state));
  }

  private isSpeechRecognitionSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private scheduleStop() {
    if (this.stopTimer !== null) return;
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = null;
      if (this.listeners.size === 0) this.stopEverything();
    }, 2000);
  }

  private stopEverything() {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const recognition = this.recognition;
    this.recognition = null;
    this.recognitionStarting = false;
    try { recognition?.abort?.(); } catch {}
    const stream = this.stream;
    this.stream = null;
    this.track = null;
    try { stream?.getTracks().forEach(track => track.stop()); } catch {}
  }

  private async ensureStarted() {
    if (!this.wanted || this.listeners.size === 0) return;
    if (!this.isSpeechRecognitionSupported()) {
      this.emit();
      return;
    }
    if (this.track?.readyState === "live") {
      this.blocked = false;
      this.emit();
      if (!this.recognition && !this.recognitionStarting) this.startRecognition();
      return;
    }
    if (this.stream) {
      try { this.stream.getTracks().forEach(track => track.stop()); } catch {}
      this.stream = null;
      this.track = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.blocked = true;
      this.emit();
      return;
    }

    try {
      const permission = await this.queryMicrophonePermission();
      if (permission === "denied") {
        this.blocked = true;
        this.emit();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true }
        },
        video: false
      });

      if (!this.wanted || this.listeners.size === 0) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      const track = stream.getAudioTracks()[0];
      if (!track) {
        stream.getTracks().forEach(item => item.stop());
        this.blocked = true;
        this.emit();
        return;
      }

      this.stream = stream;
      this.track = track;
      this.blocked = false;
      this.retryAttempt = 0;
      track.enabled = true;

      track.addEventListener("ended", this.handleTrackEnded);
      track.addEventListener("unmute", this.handleTrackUnmute);
      track.addEventListener("mute", this.handleTrackMute);

      this.emit();
      this.startRecognition();
    } catch (error) {
      if (!this.wanted) return;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
        this.blocked = true;
        this.emit();
        return;
      }
      if (name === "NotFoundError" || name === "NotReadableError" || name === "AbortError") {
        this.scheduleStreamRetry();
        return;
      }
      this.scheduleStreamRetry();
    }
  }

  private async queryMicrophonePermission(): Promise<PermissionState | "unknown"> {
    try {
      if (!navigator.permissions?.query) return "unknown";
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "denied") return "denied";
      return status.state;
    } catch {
      return "unknown";
    }
  }

  private scheduleStreamRetry() {
    if (!this.wanted || this.listeners.size === 0 || this.retryTimer !== null) return;
    const delay = Math.min(5000, 500 * Math.max(1, this.retryAttempt + 1));
    this.retryAttempt = Math.min(this.retryAttempt + 1, 10);
    this.emit();
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.ensureStarted();
    }, delay);
  }

  private scheduleRecognitionRetry() {
    if (!this.wanted || !this.track || this.track.readyState !== "live") return;
    if (this.retryTimer !== null || this.recognitionStarting || this.recognition) return;
    const delay = Math.min(5000, 300 * Math.max(1, this.retryAttempt + 1));
    this.retryAttempt = Math.min(this.retryAttempt + 1, 10);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.startRecognition();
    }, delay);
  }

  private startRecognition() {
    if (!this.wanted || !this.track || this.track.readyState !== "live") return;
    if (this.recognition || this.recognitionStarting) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.emit();
      return;
    }

    this.recognitionStarting = true;
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      this.recognitionStarting = false;
      if (!this.wanted || !this.track || this.track.readyState !== "live") {
        try { recognition.abort(); } catch {}
        return;
      }
      this.recognition = recognition;
      this.retryAttempt = 0;
      this.emit();
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) {
          finalText += " " + String(result[0]?.transcript ?? "");
        }
      }
      const text = finalText.trim();
      if (text) {
        this.transcriptListeners.forEach(listener => listener(text));
        this.manualRequested = false;
      }
    };

    recognition.onerror = (event: any) => {
      const error = String(event?.error ?? "");
      if (this.recognition === recognition) this.recognition = null;
      this.recognitionStarting = false;

      if (error === "not-allowed") {
        void this.handleNotAllowedRecognitionError();
        return;
      }

      // These are service/session failures, not permission loss.
      // Keep the physical MediaStream alive and restart recognition.
      if (
        error === "service-not-allowed" ||
        error === "audio-capture" ||
        error === "network" ||
        error === "no-speech" ||
        error === "aborted" ||
        error === "language-not-supported"
      ) {
        this.scheduleRecognitionRetry();
        return;
      }

      this.scheduleRecognitionRetry();
    };

    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      this.recognitionStarting = false;
      if (!this.wanted || !this.track || this.track.readyState !== "live") return;
      // SpeechRecognition.end means the recognition service disconnected;
      // it does not mean that the microphone MediaStream ended.
      this.scheduleRecognitionRetry();
    };

    try {
      // Chrome 135+ supports passing the existing MediaStreamTrack.
      // We intentionally do not fall back to recognition.start() because
      // that would create a second independent microphone capture path.
      recognition.start(this.track);
    } catch {
      this.recognitionStarting = false;
      try { recognition.abort(); } catch {}
      this.scheduleRecognitionRetry();
    }
  }

  private async handleNotAllowedRecognitionError() {
    const permission = await this.queryMicrophonePermission();
    if (permission === "denied") {
      this.blocked = true;
      this.emit();
      return;
    }
    this.scheduleRecognitionRetry();
  }

  private handleTrackEnded = () => {
    if (!this.wanted) return;
    this.recognition = null;
    this.recognitionStarting = false;
    this.track = null;
    this.stream = null;
    this.scheduleStreamRetry();
  };

  private handleTrackMute = () => {
    // A muted MediaStreamTrack is temporarily unable to provide data.
    // It is not equivalent to permission revocation and must not stop
    // the microphone controller.
    this.emit();
  };

  private handleTrackUnmute = () => {
    if (!this.wanted) return;
    if (!this.recognition && !this.recognitionStarting) this.startRecognition();
    this.emit();
  };
}

export const morokMicrophone = new MorokMicrophoneController();
