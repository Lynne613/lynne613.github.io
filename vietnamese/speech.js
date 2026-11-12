// Browser speech helpers. Transcript matching is not a pronunciation assessment.
const clean = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('vi')
  .replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
const unaccent = value => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

export function compareTranscript(expected, actual) {
  const target = clean(expected), heard = clean(actual);
  const a = target ? target.split(' ') : [], b = heard ? heard.split(' ') : [];
  const distance = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i ? (j ? 0 : i) : j));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      distance[i][j] = Math.min(distance[i - 1][j] + 1, distance[i][j - 1] + 1,
        distance[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const matches = a.map(() => false);
  let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && a[i - 1] === b[j - 1] && distance[i][j] === distance[i - 1][j - 1]) {
      matches[--i] = true; j--;
    } else if (i && j && distance[i][j] === distance[i - 1][j - 1] + 1) {
      i--; j--;
    } else if (i && distance[i][j] === distance[i - 1][j] + 1) i--;
    else j--;
  }
  return {
    exact: Boolean(target) && target === heard,
    accentOnly: Boolean(target && heard) && target !== heard && unaccent(target) === unaccent(heard),
    similarity: a.length || b.length
      ? Math.round(100 * (1 - distance[a.length][b.length] / Math.max(a.length, b.length))) : 0,
    words: a.map((text, k) => ({ text, match: matches[k] })), heard,
  };
}

const recognitionErrors = {
  'not-allowed': '麥克風或語音辨識權限被拒絕。請在瀏覽器的網站設定中允許後再試。',
  'service-not-allowed': '此瀏覽器無法使用語音辨識服務。你仍可錄音回放或輸入文字練習。',
  'audio-capture': '找不到可用的麥克風，請檢查裝置是否已連接或被其他程式占用。',
  'no-speech': '沒有辨識到語音。請靠近麥克風，再說一次完整句子。',
  network: '語音辨識服務連線失敗。請確認網路，或改用錄音回放。',
  'language-not-supported': '此瀏覽器的辨識服務不支援越南語。請改用錄音回放。',
};
const recordingError = error => ({
  NotAllowedError: '麥克風權限被拒絕。請在瀏覽器的網站設定中允許後再試。',
  NotFoundError: '找不到麥克風，請連接可用的麥克風後再試。',
  NotReadableError: '無法讀取麥克風。請檢查是否被其他程式占用。',
  SecurityError: '瀏覽器禁止使用麥克風。請以 HTTPS 或 localhost 開啟。',
}[error?.name] || '錄音無法啟動，請檢查麥克風及瀏覽器設定。');

export class SpeechController extends EventTarget {
  constructor() {
    super();
    this._epoch = 0;
    this._speechEpoch = 0;
    this._disposed = false;
    this._recognition = null;
    this._recording = null;
    this._pendingRecord = null;
    this._url = null;
  }

  get capabilities() {
    const secure = globalThis.isSecureContext === true;
    return {
      recognition: secure && Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition),
      recording: secure && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder),
      tts: Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance), secure,
    };
  }

  getVoices() {
    return globalThis.speechSynthesis?.getVoices().filter(voice => /^vi(?:[-_]|$)/i.test(voice.lang)) || [];
  }

  async speak(text, { rate = 0.85, voiceURI } = {}) {
    if (this._disposed) return false;
    this._cancelInput();
    this.cancelSpeech();
    if (!this.capabilities.tts) throw new Error('此瀏覽器不支援示範朗讀。');
    const epoch = this._speechEpoch;
    let voices = this.getVoices();
    if (!voices.length) {
      await new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          globalThis.speechSynthesis.removeEventListener?.('voiceschanged', finish);
          resolve();
        };
        const timer = setTimeout(finish, 1200);
        globalThis.speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true });
      });
      if (this._disposed || epoch !== this._speechEpoch) return false;
      voices = this.getVoices();
    }
    if (!voices.length) throw new Error('尚未找到越南語朗讀聲音。請安裝系統越南語聲音或換用有越南語語音的瀏覽器。');
    const voice = voices.find(item => item.voiceURI === voiceURI) || voices[0];
    const utterance = new globalThis.SpeechSynthesisUtterance(String(text));
    utterance.lang = 'vi-VN';
    utterance.voice = voice;
    utterance.rate = Math.min(1.2, Math.max(0.5, Number(rate) || 0.85));
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (value, error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        utterance.onend = utterance.onerror = null;
        if (this._speechFinish === cancel) this._speechFinish = null;
        error ? reject(error) : resolve(value);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(() => { this.cancelSpeech(); finish(false); }, 60000);
      this._speechFinish = cancel;
      utterance.onend = () => finish(true);
      utterance.onerror = event => ['canceled', 'interrupted'].includes(event.error)
        ? finish(false) : finish(false, new Error('示範朗讀失敗，請重新選擇越南語聲音後再試。'));
      try { globalThis.speechSynthesis.speak(utterance); }
      catch { finish(false, new Error('示範朗讀無法啟動，請再按一次播放。')); }
    });
  }

  cancelSpeech() {
    this._speechEpoch++;
    this._speechFinish?.();
    this._speechFinish = null;
    globalThis.speechSynthesis?.cancel();
  }

  startRecognition({ onInterim, onResult, onError, onEnd } = {}) {
    if (this._disposed) return false;
    this.cancelSpeech();
    this._cancelInput();
    if (!this.capabilities.recognition) {
      onError?.(this.capabilities.secure
        ? '此瀏覽器不支援語音辨識。你仍可使用錄音回放或輸入文字練習。'
        : '語音辨識需要 HTTPS 或 localhost，請透過安全網址開啟。');
      onEnd?.();
      return false;
    }
    const epoch = this._epoch;
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const active = () => !this._disposed && epoch === this._epoch && this._recognition === recognition;
    const finish = () => {
      if (!active()) return;
      clearTimeout(this._recognitionTimer);
      clearTimeout(this._recognitionStopTimer);
      this._recognition = null;
      this._recognitionFinish = null;
      onEnd?.();
    };
    recognition.onresult = event => {
      if (!active()) return;
      let final = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += `${result[0].transcript} `;
        else interim += `${result[0].transcript} `;
      }
      if (interim.trim()) onInterim?.(interim.trim());
      if (final.trim()) onResult?.(final.trim());
    };
    recognition.onerror = event => {
      if (!active()) return;
      if (event.error !== 'aborted') onError?.(recognitionErrors[event.error] || '語音辨識失敗，請再試一次或改用錄音回放。');
      finish();
      try { recognition.abort(); } catch { /* Service already ended. */ }
    };
    recognition.onend = finish;
    this._recognition = recognition;
    this._recognitionFinish = finish;
    this._recognitionTimer = setTimeout(() => this.stopRecognition(), 30000);
    try { recognition.start(); return true; }
    catch {
      onError?.('語音辨識無法啟動，請稍候再按一次麥克風。');
      finish();
      return false;
    }
  }

  stopRecognition() {
    if (!this._recognition) return;
    const recognition = this._recognition;
    const finish = this._recognitionFinish;
    clearTimeout(this._recognitionStopTimer);
    this._recognitionStopTimer = setTimeout(() => {
      if (this._recognition !== recognition) return;
      finish?.();
      try { recognition.abort(); } catch { /* Service already ended. */ }
    }, 2000);
    try { recognition.stop(); }
    catch {
      finish?.();
      try { recognition.abort(); } catch { /* Service already ended. */ }
    }
  }

  _cancelRecognition() {
    clearTimeout(this._recognitionTimer);
    clearTimeout(this._recognitionStopTimer);
    const recognition = this._recognition;
    this._recognition = null;
    this._recognitionFinish = null;
    if (!recognition) return;
    recognition.onresult = recognition.onerror = recognition.onend = null;
    try { recognition.abort(); } catch { /* Already stopped. */ }
  }

  async startRecording({ onLevel, onStop, onError } = {}) {
    if (this._disposed) return false;
    this.cancelSpeech();
    this._cancelInput();
    this._revokeURL();
    if (!this.capabilities.recording) {
      onError?.(this.capabilities.secure ? '此瀏覽器不支援錄音回放。'
        : '錄音需要 HTTPS 或 localhost，請透過安全網址開啟。');
      return false;
    }
    const epoch = this._epoch;
    this._pendingRecord = epoch;
    let stream;
    try {
      stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
      if (this._disposed || epoch !== this._epoch) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      this._pendingRecord = null;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(type => globalThis.MediaRecorder.isTypeSupported?.(type));
      const recorder = new globalThis.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const state = { recorder, stream, chunks: [], timer: null, frame: null, context: null, failed: false };
      const active = () => !this._disposed && epoch === this._epoch && this._recording === state;
      this._recording = state;
      recorder.ondataavailable = event => { if (active() && event.data.size) state.chunks.push(event.data); };
      recorder.onerror = () => {
        if (!active()) return;
        state.failed = true;
        onError?.('錄音過程發生錯誤，請重新錄製。');
        this.stopRecording();
      };
      recorder.onstop = () => {
        const current = active();
        this._releaseRecording(state);
        if (!current) return;
        this._recording = null;
        if (state.failed) return;
        const blob = new Blob(state.chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (!blob.size) { onError?.('錄音沒有取得音訊，請再試一次。'); return; }
        this._revokeURL();
        this._url = URL.createObjectURL(blob);
        onStop?.({ url: this._url, blob });
      };
      recorder.start();
      state.timer = setTimeout(() => { if (active()) this.stopRecording(); }, 30000);
      if (onLevel) this._meter(state, active, onLevel);
      return true;
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (!this._disposed && epoch === this._epoch) {
        this._pendingRecord = null;
        if (this._recording) this._releaseRecording(this._recording);
        this._recording = null;
        onError?.(recordingError(error));
      }
      return false;
    }
  }

  _meter(state, active, onLevel) {
    try {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return;
      state.context = new Context();
      const analyser = state.context.createAnalyser();
      analyser.fftSize = 256;
      state.context.createMediaStreamSource(state.stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const update = () => {
        if (!active() || state.recorder.state !== 'recording') return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
        onLevel(Math.min(1, rms * 4));
        state.frame = globalThis.requestAnimationFrame(update);
      };
      state.context.resume().catch(() => {});
      update();
    } catch { /* Recording still works without a level meter. */ }
  }

  stopRecording() {
    if (this._pendingRecord !== null) { this._epoch++; this._pendingRecord = null; }
    const state = this._recording;
    if (!state) return;
    clearTimeout(state.timer);
    try { if (state.recorder.state !== 'inactive') state.recorder.stop(); }
    catch { this._releaseRecording(state); this._recording = null; }
    state.stream.getTracks().forEach(track => track.stop());
  }

  _releaseRecording(state) {
    clearTimeout(state.timer);
    if (state.frame !== null) globalThis.cancelAnimationFrame?.(state.frame);
    state.stream.getTracks().forEach(track => track.stop());
    if (state.context && state.context.state !== 'closed') state.context.close().catch(() => {});
  }

  _cancelInput() {
    this._epoch++;
    this._pendingRecord = null;
    this._cancelRecognition();
    const state = this._recording;
    this._recording = null;
    if (state) {
      state.recorder.ondataavailable = state.recorder.onstop = state.recorder.onerror = null;
      try { if (state.recorder.state !== 'inactive') state.recorder.stop(); } catch { /* Already stopped. */ }
      this._releaseRecording(state);
    }
  }

  _revokeURL() {
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = null;
  }

  dispose() {
    this._disposed = true;
    this.cancelSpeech();
    this._cancelInput();
    this._revokeURL();
  }
}
