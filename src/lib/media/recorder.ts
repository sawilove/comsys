// Запись голосового: MediaRecorder (Opus в WebM, на iPhone AAC в MP4) + волна громкости.

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];
export const MAX_VOICE_MS = 10 * 60 * 1000;
const BARS = 48;

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export function canRecord() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export interface VoiceResult {
  blob: Blob;
  mime: string;
  durationMs: number;
  waveform: number[];
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private levels: number[] = [];
  private startedAt = 0;
  onLevel: (level: number, elapsedMs: number) => void = () => {};
  onLimit: () => void = () => {};

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mime = pickMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = performance.now();

    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
    } catch {
      this.analyser = null; // волна не обязательна
    }
    const buf = new Uint8Array(1024);
    this.timer = setInterval(() => {
      let level = 0;
      if (this.analyser) {
        this.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        level = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      }
      this.levels.push(level);
      const elapsed = performance.now() - this.startedAt;
      this.onLevel(level, elapsed);
      if (elapsed >= MAX_VOICE_MS) this.onLimit();
    }, 60);
  }

  async stop(): Promise<VoiceResult | null> {
    const rec = this.rec;
    if (!rec) return null;
    const durationMs = performance.now() - this.startedAt;
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    if (rec.state !== 'inactive') rec.stop();
    await done;
    const mime = (rec.mimeType || pickMime() || 'audio/webm').split(';')[0];
    const blob = new Blob(this.chunks, { type: mime });
    const waveform = downsample(this.levels, BARS);
    this.cleanup();
    if (durationMs < 500 || blob.size === 0) return null;
    return { blob, mime, durationMs: Math.round(durationMs), waveform };
  }

  cancel() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.cleanup();
  }

  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.rec = null;
    this.levels = [];
  }
}

export function downsample(levels: number[], bars: number): number[] {
  if (!levels.length) return Array(bars).fill(8);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = 0;
    for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j]);
    out.push(Math.max(6, Math.round(peak * 100)));
  }
  return out;
}
