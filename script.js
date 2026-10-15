(() => {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const intro = document.getElementById('intro');
  const outro = document.getElementById('outro');
  const replayBtn = document.getElementById('replay');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== Таймлайн (секунды) =====
  const T_FORM = 3.4;            // частицы собираются в сердце
  const T_BEAT = T_FORM + 4.2;   // сердце бьётся
  const T_BURST = T_BEAT + 1.6;  // сердце распадается
  const T_GATHER = T_BURST + 5.5;// частицы летят к фото
  const T_FADE = T_GATHER + 2.2; // проявляется настоящее фото

  const BLUE_SHADES = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#bfdbfe', '#1d4ed8', '#f9a8d4'];

  let W, H, DPR, cx, cy, heartR;
  let particles = [];
  let photo = null, photoRect = null;
  let startTime = 0;
  let introShown = false, outroShown = false;

  // ===== Утилиты =====
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PALETTE = BLUE_SHADES.map(hexToRgb);

  // Случайная точка внутри сердца (формула: (x²+y²-1)³ - x²y³ ≤ 0), координаты примерно -1..1
  function randomHeartPoint() {
    while (true) {
      const x = (Math.random() * 2 - 1) * 1.3;
      const y = (Math.random() * 2 - 1) * 1.3;
      const a = x * x + y * y - 1;
      if (a * a * a - x * x * y * y * y <= 0) return [x * 0.82, -y * 0.82 - 0.05];
    }
  }

  // ===== Загрузка фото =====
  function loadPhoto() {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = window.PHOTO_SRC || 'photo.jpg';
    });
  }

  // ===== Подготовка частиц =====
  function build() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    cx = W / 2; cy = H / 2;
    heartR = Math.min(W, H) * 0.3;

    // Размер фото на экране (вписываем с запасом под заголовок и подпись)
    const maxH = H * (W < 700 ? 0.62 : 0.74);
    const maxW = W * 0.9;
    const ratio = photo ? photo.width / photo.height : 1;
    let ph = maxH, pw = ph * ratio;
    if (pw > maxW) { pw = maxW; ph = pw / ratio; }
    photoRect = { x: cx - pw / 2, y: cy - ph / 2 - (W < 700 ? 8 : 0), w: pw, h: ph };

    // Считываем цвета фото на сетке
    const maxParticles = W < 700 ? 5200 : 9500;
    const step = Math.max(2, Math.ceil(Math.sqrt((pw * ph) / maxParticles)));
    const off = document.createElement('canvas');
    off.width = Math.round(pw); off.height = Math.round(ph);
    const octx = off.getContext('2d', { willReadFrequently: true });
    let data = null;
    if (photo) {
      octx.drawImage(photo, 0, 0, off.width, off.height);
      try { data = octx.getImageData(0, 0, off.width, off.height).data; } catch (e) { data = null; }
    }

    const targets = [];
    for (let y = step / 2; y < off.height; y += step) {
      for (let x = step / 2; x < off.width; x += step) {
        let rgb = [180, 200, 255];
        if (data) {
          const i = (Math.floor(y) * off.width + Math.floor(x)) * 4;
          rgb = [data[i], data[i + 1], data[i + 2]];
        }
        targets.push({ x: photoRect.x + x, y: photoRect.y + y, rgb });
      }
    }

    particles = targets.map(t => {
      const [hx, hy] = randomHeartPoint();
      const ang = Math.random() * Math.PI * 2;
      const far = Math.max(W, H) * (0.6 + Math.random() * 0.6);
      const dist = Math.hypot(t.x - cx, t.y - cy) / (Math.hypot(photoRect.w, photoRect.h) / 2);
      const base = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const burstAng = Math.atan2(hy, hx) + (Math.random() - .5) * 1.2;
      const burstDist = heartR * (1.2 + Math.random() * 2.6);
      return {
        // старт: случайное место за пределами сердца
        sx: cx + Math.cos(ang) * far, sy: cy + Math.sin(ang) * far,
        // сердце
        hx: cx + hx * heartR, hy: cy + hy * heartR,
        // разлёт
        bx: cx + hx * heartR + Math.cos(burstAng) * burstDist,
        by: cy + hy * heartR + Math.sin(burstAng) * burstDist,
        // фото
        px: t.x, py: t.y, prgb: t.rgb,
        base,
        size: step * (0.7 + Math.random() * 0.5),
        formDelay: Math.random() * 0.45,
        gatherDelay: clamp(dist * 0.55 + Math.random() * 0.35, 0, 0.9),
        swirl: (Math.random() - .5) * 2,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.6 + Math.random() * 0.8
      };
    });
  }

  // ===== Пульс сердца (двойной удар) =====
  function beat(t) {
    const p = (t % 1.05) / 1.05;
    return 1 + 0.07 * Math.exp(-Math.pow((p - 0.12) * 11, 2)) + 0.045 * Math.exp(-Math.pow((p - 0.32) * 11, 2));
  }

  // ===== Позиция и цвет частицы в момент времени t =====
  function place(p, t, out) {
    let x, y, rgb = p.base, a = 0.95, size = p.size;

    if (t < T_FORM) {
      // 1. Собираются в сердце по спирали
      const e = easeOutCubic(clamp((t / T_FORM - p.formDelay) / (1 - p.formDelay)));
      const curve = (1 - e) * p.swirl * 160;
      x = lerp(p.sx, p.hx, e) + (p.hy - p.sy) * 0.0 + Math.sin(e * Math.PI) * curve;
      y = lerp(p.sy, p.hy, e) + Math.sin(e * Math.PI) * -curve * 0.6;
      a = 0.2 + 0.75 * e;
    } else if (t < T_BURST) {
      // 2. Сердце бьётся и дышит
      const s = beat(t - T_FORM);
      const k = clamp((t - T_BEAT) / (T_BURST - T_BEAT)); // дрожь перед распадом
      const jit = k * k * 7;
      x = cx + (p.hx - cx) * s + Math.sin(t * 3 + p.phase) * (1.5 + jit);
      y = cy + (p.hy - cy) * s + Math.cos(t * 2.6 + p.phase) * (1.5 + jit);
      a = 0.75 + 0.25 * Math.sin(t * 5 * p.twinkle + p.phase);
    } else if (t < T_GATHER) {
      const u = t - T_BURST;
      const burstDur = 1.7;
      if (u < burstDur) {
        // 3. Взрыв — частицы разлетаются
        const e = easeOutCubic(u / burstDur);
        x = lerp(p.hx, p.bx, e) + Math.sin(t * 2 + p.phase) * 4 * e;
        y = lerp(p.hy, p.by, e) + Math.cos(t * 2 + p.phase) * 4 * e;
        a = 0.95;
      } else {
        // 4. Летят к своим местам в фотографии и меняют цвет
        const span = T_GATHER - T_BURST - burstDur;
        const e = easeInOut(clamp(((u - burstDur) / span - p.gatherDelay * 0.55) / 0.45));
        const arc = Math.sin(e * Math.PI) * p.swirl * 90;
        x = lerp(p.bx, p.px, e) + arc;
        y = lerp(p.by, p.py, e) - arc * 0.5;
        const c = easeInOut(clamp((e - 0.35) / 0.65));
        rgb = [lerp(p.base[0], p.prgb[0], c), lerp(p.base[1], p.prgb[1], c), lerp(p.base[2], p.prgb[2], c)];
        a = 0.95;
        size = lerp(p.size, p.size * 1.15, e);
      }
    } else {
      // 5. Фото собрано — лёгкое мерцание
      const w = Math.min(1, (t - T_GATHER) / 1.5);
      x = p.px + Math.sin(t * 1.4 + p.phase) * 0.6 * (1 - w * 0.6);
      y = p.py + Math.cos(t * 1.2 + p.phase) * 0.6 * (1 - w * 0.6);
      rgb = p.prgb; a = 1; size = p.size * 1.15;
    }
    out.x = x; out.y = y; out.rgb = rgb; out.a = a; out.size = size;
  }

  // ===== Кадр =====
  const o = { x: 0, y: 0, rgb: null, a: 1, size: 1 };

  function frame(now) {
    const t = reduceMotion ? T_FADE + 3 : (now - startTime) / 1000;
    const settled = t > T_GATHER + 0.5;

    // Шлейф: полупрозрачная заливка вместо полной очистки
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = settled ? 'rgba(5,7,18,0.5)' : 'rgba(5,7,18,0.22)';
    ctx.fillRect(0, 0, W, H);

    // Мягкое свечение за сердцем
    if (t < T_GATHER) {
      const glow = t < T_FORM ? t / T_FORM : 1;
      const s = t >= T_FORM && t < T_BURST ? beat(t - T_FORM) : 1;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, heartR * 1.7 * s);
      g.addColorStop(0, `rgba(59,130,246,${0.16 * glow})`);
      g.addColorStop(0.6, `rgba(244,114,182,${0.05 * glow})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Светящиеся частицы пока они синие, обычные — когда становятся фото
    ctx.globalCompositeOperation = t < T_GATHER ? 'lighter' : 'source-over';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      place(p, t, o);
      ctx.fillStyle = `rgba(${o.rgb[0] | 0},${o.rgb[1] | 0},${o.rgb[2] | 0},${o.a})`;
      ctx.fillRect(o.x - o.size / 2, o.y - o.size / 2, o.size, o.size);
    }

    // Настоящее фото плавно проявляется поверх частиц — эффект реальности
    if (photo && t > T_GATHER) {
      const k = easeInOut(clamp((t - T_GATHER) / (T_FADE - T_GATHER)));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k;
      ctx.drawImage(photo, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
      ctx.globalAlpha = 1;
    }

    // Тексты
    if (!introShown && t > T_FORM - 0.8) { intro.classList.add('show'); introShown = true; }
    if (t > T_BURST + 0.2) intro.classList.add('hide');
    if (!outroShown && t > T_FADE - 0.5) { outro.classList.add('show'); outroShown = true; }

    requestAnimationFrame(frame);
  }

  // ===== Запуск и повтор =====
  function restart() {
    intro.classList.remove('show', 'hide');
    outro.classList.remove('show');
    introShown = outroShown = false;
    ctx.fillStyle = '#050712';
    ctx.fillRect(0, 0, W, H);
    startTime = performance.now();
  }

  replayBtn.addEventListener('click', restart);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  loadPhoto().then(img => {
    photo = img;
    build();
    startTime = performance.now();
    requestAnimationFrame(frame);
  });
})();
