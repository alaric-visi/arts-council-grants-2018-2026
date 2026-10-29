import { useEffect, useRef } from "react";

export interface ArcSignalLoaderProps {
  size?: number;
  label?: string;
  sublabel?: string;
}

export const isBotOrCrawler = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const ua = (navigator.userAgent || "").toLowerCase();
  const botPatterns = [
    "googlebot",
    "bingbot",
    "slurp",
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "sogou",
    "exabot",
    "facebot",
    "facebookexternalhit",
    "ia_archiver",
    "lighthouse",
    "chrome-lighthouse",
    "ptst",
    "headlesschrome",
    "bot",
    "crawl",
    "spider",
    "mediapartners-google",
    "adsbot-google",
    "applebot",
    "semrushbot",
    "ahrefsbot",
    "petalbot"
  ];
  return botPatterns.some((pattern) => ua.includes(pattern));
};

export const ArcSignalLoader = ({
  size: fixedSize,
  label = "INITIALISING ARCHIVE SIGNAL",
  sublabel = "15,000+ National Lottery Project Grants · 2018–2026"
}: ArcSignalLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const ctx = cvs.getContext("2d", { alpha: false });
    if (!ctx) return;

    let mounted = true;
    let animId = 0;
    const TAU = Math.PI * 2;
    let D = 0;
    let DPR = 1;
    let CX = 0;
    let CY = 0;
    let S = 1;
    const calm = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t0 = 0;

    /* ---------- patterns ---------- */
    let noiseTiles: CanvasPattern[] = [];
    let scanPat: CanvasPattern | null = null;

    function buildNoise() {
      if (!ctx) return;
      noiseTiles = [];
      for (let n = 0; n < 4; n++) {
        const s = 140;
        const nc = document.createElement("canvas");
        nc.width = nc.height = s;
        const nx = nc.getContext("2d");
        if (nx) {
          const id = nx.createImageData(s, s);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            const v = Math.random() * 255;
            d[i] = v;
            d[i + 1] = v;
            d[i + 2] = v;
            d[i + 3] = Math.random() * Math.random() * 85;
          }
          nx.putImageData(id, 0, 0);
          const pat = ctx.createPattern(nc, "repeat");
          if (pat) noiseTiles.push(pat);
        }
      }
      const sc = document.createElement("canvas");
      sc.width = 1;
      sc.height = 3;
      const sx = sc.getContext("2d");
      if (sx) {
        sx.fillStyle = "rgba(0,0,0,0.5)";
        sx.fillRect(0, 0, 1, 1);
        scanPat = ctx.createPattern(sc, "repeat");
      }
    }

    /* ---------- sizing ---------- */
    function measure() {
      if (fixedSize) return fixedSize;
      const vw = (typeof window !== "undefined" ? window.innerWidth : 800) || 800;
      const vh = (typeof window !== "undefined" ? window.innerHeight : 600) || 600;
      return Math.round(Math.max(140, Math.min(Math.min(vw, vh) * 0.44, 380)));
    }

    function resize() {
      if (!cvs || !ctx) return;
      D = measure();
      DPR = Math.min(2, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1);
      cvs.style.width = D + "px";
      cvs.style.height = D + "px";
      cvs.width = Math.round(D * DPR);
      cvs.height = Math.round(D * DPR);
      CX = D * 0.5;
      CY = D * 0.5;
      S = D / 360;
      buildNoise();
    }

    window.addEventListener("resize", resize);

    /* how much horizontal room the disc allows at a given height */
    function fitAt(y: number) {
      const v = (y - CY) / (D * 0.5);
      return Math.sqrt(Math.max(0, 1 - Math.min(1, v * v)));
    }

    /* ---------- signal ---------- */
    const NB = 56;
    const bands = new Float32Array(NB);
    const WV = 256;
    const wave = new Float32Array(WV);

    function envelope(t: number) {
      const b = (t * (calm ? 68 : 112)) / 60;
      const kick = Math.exp(-(b % 1) * 6);
      const snare = Math.exp(-((b + 0.5) % 2) * 5) * 0.5;
      const hat = Math.exp(-((b * 2) % 1) * 14) * 0.22;
      return Math.min(1.7, kick * 0.85 + snare + hat + 0.14);
    }

    function updateSignal(t: number, amp: number) {
      for (let k = 0; k < NB; k++) {
        const f = k / NB;
        let v = Math.sin(t * (1.7 + k * 0.41) + k * 2.1) * 0.5 + 0.5;
        v *= Math.pow(1 - f, 1.15);
        v = v * 0.65 + Math.random() * 0.12;
        v *= 0.35 + amp * 0.8;
        bands[k] = bands[k] * 0.74 + v * 0.26;
      }
      for (let i = 0; i < WV; i++) {
        const u = i / (WV - 1);
        let s = 0;
        s += Math.sin(u * TAU * 3 + t * 4.6) * 0.52;
        s += Math.sin(u * TAU * 7.3 - t * 3.1) * 0.27;
        s += Math.sin(u * TAU * 17.7 + t * 9.4) * 0.13;
        s += (Math.random() - 0.5) * 0.18;
        wave[i] = s * amp;
      }
    }

    /* ---------- glitch ---------- */
    let g = 0;
    let gUntil = 0;
    let dropUntil = 0;
    let nextDrop = 4;

    function updateGlitch(t: number, amp: number) {
      if (t > gUntil && Math.random() < (calm ? 0.006 : 0.03)) {
        gUntil = t + 0.05 + Math.random() * (calm ? 0.14 : 0.38);
        g = Math.max(g, (calm ? 0.25 : 0.35) + Math.random() * (calm ? 0.3 : 0.65));
      }
      if (t > gUntil) g *= 0.86;
      if (g < 0.004) g = 0;
      if (!calm && t > nextDrop) {
        dropUntil = t + 0.05 + Math.random() * 0.16;
        nextDrop = t + 5 + Math.random() * 7;
      }
    }

    /* ---------- colour flares ---------- */
    const FLARE_HUES = [188, 312, 96, 36];
    let flare = 0;
    let flareHue = 188;
    let flareUntil = 0;
    let nextFlare = 1.6;

    function hsl(h: number, s: number, l: number) {
      return "hsl(" + (((h % 360) + 360) % 360) + "," + Math.round(s) + "%," + Math.round(l) + "%)";
    }

    function updateFlare(t: number) {
      if (t > nextFlare) {
        flareHue = FLARE_HUES[(Math.random() * FLARE_HUES.length) | 0];
        flare = Math.max(flare, 0.6 + Math.random() * 0.4);
        flareUntil = t + 0.16 + Math.random() * (calm ? 0.3 : 0.55);
        nextFlare = t + (calm ? 4 : 2.2) + Math.random() * (calm ? 6 : 4.5);
      }
      if (g > 0.6 && flare < 0.25) flare = 0.25 + Math.random() * 0.3;
      if (t > flareUntil) flare *= 0.9;
      if (flare < 0.005) flare = 0;
    }

    /* ---------- bolt generation ---------- */
    interface Point {
      x: number;
      y: number;
    }

    function subdivide(pts: Point[], disp: number, iters: number): Point[] {
      for (let it = 0; it < iters; it++) {
        const np: Point[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          const f = 0.25 + 0.75 * fitAt(my);
          np.push(a, {
            x: mx + (Math.random() - 0.5) * disp * f,
            y: my + (Math.random() - 0.5) * disp * 0.22
          });
        }
        np.push(pts[pts.length - 1]);
        pts = np;
        disp *= 0.55;
      }
      return pts;
    }

    function makeBranch(pts: Point[], at: number, dir: number, len: number): Point[] {
      const p = pts[at];
      const ang = -Math.PI * 0.5 + dir * (0.5 + Math.random() * 0.75);
      const end = {
        x: p.x + Math.cos(ang) * len * (Math.random() < 0.5 ? -1 : 1),
        y: p.y + Math.abs(Math.sin(ang)) * len
      };
      return subdivide([{ x: p.x, y: p.y }, end], len * 0.42, 4);
    }

    interface Bolt {
      pts: Point[];
      branches: Point[][];
      born: number;
      dur: number;
      seed: number;
      w: number;
    }

    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      age: number;
    }

    const bolts: Bolt[] = [];
    const sparks: Spark[] = [];
    let flash = 0;
    let nextStrike = 0;
    let prevAmp = 0;

    function strike(t: number, power: number) {
      const startX = CX + (Math.random() - 0.5) * D * 0.34;
      const endX = CX + (Math.random() - 0.5) * D * 0.5;
      const pts = subdivide([{ x: startX, y: -D * 0.08 }, { x: endX, y: D * 1.08 }], D * 0.28, 7);

      const branches: Point[][] = [];
      const nb = 1 + (((Math.random() * 3 + power * 2) | 0));
      for (let i = 0; i < nb; i++) {
        const at = (((0.15 + Math.random() * 0.65) * (pts.length - 1)) | 0);
        branches.push(makeBranch(pts, at, Math.random() < 0.5 ? -1 : 1, D * (0.12 + Math.random() * 0.26)));
      }

      bolts.push({
        pts,
        branches,
        born: t,
        dur: 0.26 + Math.random() * 0.42,
        seed: Math.random() * 10,
        w: (1.0 + power * 1.1) * S
      });
      if (bolts.length > 7) bolts.shift();

      flash = Math.max(flash, 0.35 + power * 0.45);
      g = Math.max(g, 0.2 + power * 0.4);
      if (Math.random() < 0.28) {
        flare = Math.max(flare, 0.45 + Math.random() * 0.4);
        flareUntil = t + 0.2 + Math.random() * 0.3;
        flareHue = FLARE_HUES[(Math.random() * FLARE_HUES.length) | 0];
      }

      /* sparks off branch tips */
      for (let b = 0; b < branches.length; b++) {
        const tip = branches[b][branches[b].length - 1];
        const n = 2 + (((Math.random() * 4) | 0));
        for (let s2 = 0; s2 < n; s2++) {
          sparks.push({
            x: tip.x,
            y: tip.y,
            vx: (Math.random() - 0.5) * 90 * S,
            vy: (Math.random() - 0.2) * 90 * S,
            life: 0.18 + Math.random() * 0.35,
            age: 0
          });
        }
      }
      if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
    }

    function updateStrikes(t: number, dt: number, amp: number) {
      if (amp > 1.15 && prevAmp <= 1.15) strike(t, Math.min(1, (amp - 1.05) / 0.6));
      prevAmp = amp;
      if (t > nextStrike) {
        strike(t, Math.random() * 0.6);
        nextStrike = t + (calm ? 0.6 : 0.22) + Math.random() * (calm ? 1.2 : 0.75);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 40 * S * dt;
        if (s.age >= s.life) sparks.splice(i, 1);
      }
      flash *= 0.84;
      if (flash < 0.004) flash = 0;
    }

    /* ---------- drawing ---------- */
    function tracePath(pts: Point[]) {
      if (!ctx || pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }

    function strokeBolt(pts: Point[], I: number, w: number) {
      if (!ctx || pts.length === 0) return;
      tracePath(pts);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = hsl(flareHue, flare * 95, 54);
      ctx.globalAlpha = I * 0.15;
      ctx.lineWidth = w * 8;
      ctx.stroke();

      ctx.strokeStyle = hsl(flareHue, flare * 88, 70);
      ctx.globalAlpha = I * 0.3;
      ctx.lineWidth = w * 3.2;
      ctx.stroke();

      ctx.strokeStyle = hsl(flareHue, flare * 35, 97);
      ctx.globalAlpha = I * 0.95;
      ctx.lineWidth = w;
      ctx.stroke();
    }

    function coreChannel(t: number, amp: number) {
      if (!ctx) return;
      const M = 44;
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const u = i / M;
        const y = -D * 0.08 + D * 1.16 * u;
        const f = 0.2 + 0.8 * fitAt(y);
        const x =
          CX +
          (Math.sin(u * 7.1 + t * 1.6) * 0.5 +
            Math.sin(u * 17.3 - t * 2.3) * 0.3 +
            wave[(i * 6) % WV] * 0.3) *
            D *
            0.17 *
            f;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = hsl(flareHue, flare * 90, 52);
      ctx.globalAlpha = 0.1 + amp * 0.05;
      ctx.lineWidth = 7 * S;
      ctx.stroke();

      ctx.strokeStyle = hsl(flareHue, flare * 40, 92);
      ctx.globalAlpha = 0.16 + amp * 0.1;
      ctx.lineWidth = 1.1 * S;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawBolts(t: number) {
      if (!ctx) return;
      ctx.globalCompositeOperation = "lighter";
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        const age = t - b.born;
        const k = age / b.dur;
        if (k >= 1) {
          bolts.splice(i, 1);
          continue;
        }
        const env = Math.pow(1 - k, 2.3);
        const flick = 0.62 + 0.38 * Math.sin(age * 70 + b.seed);
        const I = env * flick;
        if (I <= 0.01) continue;
        strokeBolt(b.pts, I, b.w);
        for (let j = 0; j < b.branches.length; j++) {
          strokeBolt(b.branches[j], I * 0.55, b.w * 0.55);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawSparks() {
      if (!ctx) return;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const k = 1 - s.age / s.life;
        const sz = (0.9 + k * 1.8) * S;
        ctx.globalAlpha = k * 0.85;
        ctx.fillStyle = hsl(flareHue, flare * 70, 95);
        ctx.fillRect(s.x - sz * 0.5, s.y - sz * 0.5, sz, sz);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- background & overlays ---------- */
    let bgGrad: CanvasGradient | null = null;
    let bgKey = "";

    function backdrop(amp: number) {
      if (!ctx) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, D, D);

      if (bgKey !== String(D)) {
        bgGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, D * 0.5);
        bgGrad.addColorStop(0, "rgba(255,255,255,0.10)");
        bgGrad.addColorStop(0.6, "rgba(255,255,255,0.03)");
        bgGrad.addColorStop(1, "rgba(255,255,255,0)");
        bgKey = String(D);
      }
      ctx.globalAlpha = 0.55 + amp * 0.12;
      if (bgGrad) {
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, D, D);
      }

      if (flash > 0.02 || flare > 0.02) {
        const fg = ctx.createRadialGradient(CX, CY, 0, CX, CY, D * 0.55);
        fg.addColorStop(0, hsl(flareHue, flare * 90, 62));
        fg.addColorStop(1, hsl(flareHue, flare * 90, 30));
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = flash * 0.16 + flare * 0.05;
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, D, D);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
    }

    function glitchPost() {
      if (!ctx || !cvs || g <= 0) return;
      const cw = cvs.width;
      const ch = cvs.height;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      const n = 1 + (((g * 10) | 0));
      for (let i = 0; i < n; i++) {
        const sy = Math.random() * ch;
        const sh = (2 + Math.random() * 26) * S * DPR;
        const dx = (Math.random() - 0.5) * g * 70 * S * DPR;
        ctx.drawImage(cvs, 0, sy, cw, sh, dx, sy, cw, sh);
      }
      const b = ((g * 6) | 0);
      for (let j = 0; j < b; j++) {
        const bw = (20 + Math.random() * 90) * S * DPR;
        const bh = (5 + Math.random() * 34) * S * DPR;
        const sx = Math.random() * Math.max(1, cw - bw);
        const sy2 = Math.random() * Math.max(1, ch - bh);
        const ox = (Math.random() - 0.5) * g * 50 * S * DPR;
        const oy = (Math.random() - 0.5) * g * 16 * S * DPR;
        ctx.drawImage(cvs, sx, sy2, bw, bh, sx + ox, sy2 + oy, bw, bh);
      }
      if (g > 0.45) {
        const sft = g * 5 * S * DPR;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18;
        ctx.drawImage(cvs, -sft, 0);
        ctx.drawImage(cvs, sft, 0);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function signalDrop() {
      if (!ctx || !cvs) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cw = cvs.width;
      const ch = cvs.height;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,5,5,0.72)";
      ctx.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 46; i++) {
        const y = Math.random() * ch;
        const h = (1 + Math.random() * 7) * S * DPR;
        ctx.globalAlpha = 0.08 + Math.random() * 0.38;
        ctx.fillStyle = Math.random() < 0.5 ? "#2a2a2a" : "#1a1a1a";
        ctx.fillRect(0, y, cw, h);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    let vgGrad: CanvasGradient | null = null;
    let vgKey = "";

    function overlays() {
      if (!ctx || !cvs) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cw = cvs.width;
      const ch = cvs.height;

      if (noiseTiles.length > 0) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.22 + g * 0.3;
        ctx.fillStyle = noiseTiles[(Math.random() * noiseTiles.length) | 0];
        ctx.save();
        ctx.translate((Math.random() * 140) | 0, (Math.random() * 140) | 0);
        ctx.fillRect(-160, -160, cw + 320, ch + 320);
        ctx.restore();
      }

      if (scanPat) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = scanPat;
        ctx.fillRect(0, 0, cw, ch);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (vgKey !== cw + "x" + ch) {
        vgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * 0.2, cw * 0.5, ch * 0.5, cw * 0.5);
        vgGrad.addColorStop(0, "rgba(5,5,5,0)");
        vgGrad.addColorStop(0.78, "rgba(5,5,5,0.55)");
        vgGrad.addColorStop(1, "rgba(5,5,5,0.94)");
        vgKey = cw + "x" + ch;
      }
      if (vgGrad) {
        ctx.fillStyle = vgGrad;
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.restore();
    }

    /* ---------- loop ---------- */
    let last = 0;

    function frame(now: number) {
      if (!mounted || !ctx || !cvs) return;
      if (measure() !== D) resize();
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;

      const amp = envelope(t);
      updateSignal(t, amp);
      updateGlitch(t, amp);
      updateFlare(t);
      updateStrikes(t, dt, amp);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      backdrop(amp);
      coreChannel(t, amp);
      drawBolts(t);
      drawSparks();
      glitchPost();
      if (t < dropUntil) signalDrop();
      overlays();

      animId = requestAnimationFrame(frame);
    }

    resize();
    animId = requestAnimationFrame(function (n) {
      t0 = n;
      last = n;
      frame(n);
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [fixedSize]);

  return (
    <div className="flex flex-col items-center justify-center gap-5 p-4 select-none" role="status" aria-label={label}>
      <canvas
        ref={canvasRef}
        className="block rounded-full overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[#050505]"
      />
      {(label || sublabel) && (
        <div className="flex flex-col items-center gap-1.5 font-mono text-center">
          {label && (
            <div className="flex items-center gap-2 text-xs sm:text-sm tracking-[0.2em] text-white/80 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span>{label}</span>
            </div>
          )}
          {sublabel && (
            <div className="text-[11px] text-white/45 tracking-wider font-light">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
