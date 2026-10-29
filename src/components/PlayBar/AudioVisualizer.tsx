import { useEffect, useRef } from 'react';
import type { VisualizerStyle } from '../../types/electron';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  isVisible: boolean;
  volume: number;
  style: VisualizerStyle;
  className?: string;
}

const BAR_COUNT = 72;
const MIN_FREQUENCY = 20;
const MAX_FREQUENCY = 20000;

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isPlaying,
  isVisible,
  volume,
  style,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelsRef = useRef(new Float32Array(BAR_COUNT));
  const audioStateRef = useRef({ isPlaying, volume });

  useEffect(() => {
    audioStateRef.current = { isPlaying, volume };
  }, [isPlaying, volume]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !isVisible) return undefined;

    const frequencyData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let animationFrame = 0;
    let previousFrameTime = performance.now();
    const levels = levelsRef.current;

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return 0;

      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.round(bounds.width * pixelRatio);
      const height = Math.round(bounds.height * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.strokeStyle =
        getComputedStyle(canvas).getPropertyValue('--play-button-accent').trim() || '#ff4444';
      context.fillStyle = context.strokeStyle;
      context.lineWidth = style === 'wave-organic' ? 1.6 : 2.4;
      context.lineCap = style === 'bars-thin' || style === 'bars-dense' ? 'butt' : 'round';
      context.lineJoin = 'round';

      const { isPlaying: playing, volume: appVolume } = audioStateRef.current;
      if (frequencyData && playing && appVolume > 0) analyser?.getByteFrequencyData(frequencyData);
      const deltaTime = Math.min(64, Math.max(0, now - previousFrameTime));
      previousFrameTime = now;
      const attack = 1 - Math.exp(-deltaTime / 42);
      const release = 1 - Math.exp(-deltaTime / 260);
      const volumeGain = Math.pow(Math.max(0, Math.min(1, appVolume)), 0.72);
      let maxLevel = 0;

      for (let index = 0; index < BAR_COUNT; index += 1) {
        let target = 0;
        if (frequencyData && playing && analyser && appVolume > 0) {
          const sampleFrequency =
            MIN_FREQUENCY *
            (Math.min(MAX_FREQUENCY, analyser.context.sampleRate / 2) / MIN_FREQUENCY) **
              (index / (BAR_COUNT - 1));
          const frequencyIndex = Math.max(
            0,
            Math.min(
              frequencyData.length - 1,
              Math.round(sampleFrequency / (analyser.context.sampleRate / analyser.fftSize))
            )
          );
          const normalizedMagnitude = Math.max(0, (frequencyData[frequencyIndex] - 20) / 210);
          target = Math.pow(normalizedMagnitude, 0.82) * volumeGain;
        }

        const smoothing = target > levels[index] ? attack : release;
        levels[index] += (target - levels[index]) * smoothing;
        maxLevel = Math.max(maxLevel, levels[index]);
      }

      const centerY = bounds.height / 2;
      const amplitude = Math.max(2, bounds.height * 0.48);
      const step = bounds.width / (BAR_COUNT - 1);

      if (style.startsWith('wave-')) {
        context.beginPath();
        levels.forEach((level, index) => {
          const x = index * step;
          const y = centerY - Math.max(1, level * amplitude);
          if (index === 0 || style === 'wave-sharp') {
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          } else {
            const previousX = (index - 1) * step;
            const previousY = centerY - Math.max(1, levels[index - 1] * amplitude);
            context.quadraticCurveTo(
              previousX,
              previousY,
              (previousX + x) / 2,
              (previousY + y) / 2
            );
          }
        });
        context.stroke();
      } else {
        const gap = style === 'bars-dense' ? 1 : style === 'bars-thin' ? 2 : 3;
        const barWidth = Math.max(1, bounds.width / BAR_COUNT - gap);
        levels.forEach((level, index) => {
          const height = Math.max(1, level * amplitude * (style === 'bars-alternating' ? 1 : 2));
          const x = index * (bounds.width / BAR_COUNT) + gap / 2;
          const y =
            style === 'bars-alternating'
              ? index % 2 === 0
                ? centerY - height
                : centerY
              : centerY - height / 2;
          if (style === 'bars-outline') {
            context.strokeRect(x, y, barWidth, height);
          } else if (
            style === 'bars-thin' ||
            style === 'bars-dense' ||
            style === 'bars-alternating'
          ) {
            context.fillRect(x, y, barWidth, height);
          } else {
            const radius =
              style === 'bars-pill'
                ? barWidth / 2
                : style === 'bars-rounded'
                  ? Math.min(4, barWidth / 2, height / 2)
                  : 1;
            context.beginPath();
            context.roundRect(x, y, barWidth, height, radius);
            context.fill();
          }
        });
      }
      return maxLevel;
    };

    const animate = (now: number) => {
      const maxLevel = draw(now);
      if (audioStateRef.current.isPlaying || maxLevel > 0.008) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [analyser, isPlaying, isVisible, style]);

  return (
    <canvas
      ref={canvasRef}
      className={`audio-visualizer ${style} ${className}`.trim()}
      role='img'
      aria-label='Audio visualizer'
    />
  );
};

export default AudioVisualizer;
