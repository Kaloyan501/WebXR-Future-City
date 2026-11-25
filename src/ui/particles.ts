// Rain and snow drawn on a canvas over the background. The loop sleeps when nothing is falling.

interface Drop {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  kind: 'rain' | 'snow';
}

const MAX_RAIN = 420;
const MAX_SNOW = 260;

export function createParticles(canvas: HTMLCanvasElement): {
  set(rain: number, snow: number, windX: number): void;
  stop(): void;
} {
  const ctx = canvas.getContext('2d')!;
  let drops: Drop[] = [];
  let rainTarget = 0;
  let snowTarget = 0;
  let wind = 0;
  let frameId = 0;
  let last = 0;
  let w = 0;
  let h = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const spawn = (kind: Drop['kind'], anywhere: boolean): Drop => ({
    kind,
    x: Math.random() * (w + 200) - 100,
    y: anywhere ? Math.random() * h : -20,
    speed: kind === 'rain' ? 700 + Math.random() * 400 : 40 + Math.random() * 70,
    size: kind === 'rain' ? 10 + Math.random() * 8 : 1.5 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
  });

  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;

    // Grow or shrink each kind towards its target count.
    const want = { rain: Math.round(rainTarget * MAX_RAIN), snow: Math.round(snowTarget * MAX_SNOW) };
    for (const kind of ['rain', 'snow'] as const) {
      const have = drops.filter((d) => d.kind === kind).length;
      for (let i = have; i < want[kind]; i++) drops.push(spawn(kind, true));
      if (have > want[kind]) {
        let extra = have - want[kind];
        drops = drops.filter((d) => !(d.kind === kind && extra-- > 0));
      }
    }

    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (const d of drops) {
      if (d.kind === 'rain') {
        const dx = wind * 0.25 * d.speed * dt;
        d.x += dx;
        d.y += d.speed * dt;
        ctx.strokeStyle = 'rgba(214, 226, 238, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - wind * 0.25 * d.size, d.y - d.size);
        ctx.stroke();
      } else {
        d.phase += dt * 1.5;
        d.x += (wind * 40 + Math.sin(d.phase) * 15) * dt;
        d.y += d.speed * dt;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (d.y > h + 20) Object.assign(d, spawn(d.kind, false));
      if (d.x > w + 120) d.x -= w + 220;
      if (d.x < -120) d.x += w + 220;
    }

    if (drops.length > 0) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = 0;
      last = 0;
    }
  };

  return {
    set(rain, snow, windX) {
      rainTarget = rain;
      snowTarget = snow;
      wind = windX;
      if (!frameId && (rain > 0 || snow > 0)) frameId = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      drops = [];
      ctx.clearRect(0, 0, w, h);
    },
  };
}
