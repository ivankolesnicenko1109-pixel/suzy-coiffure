/* Suzy Coiffure — scènes WebGL
   1. hero : des milliers de cheveux vivants que la souris peigne, teinte au choix
   2. « Essayez votre couleur » : une mèche en 3D qu'on fait tourner et qu'on colore
   3. avant / après : transition liquide comme de la soie
   Three.js r128 (global THREE). Tout est optionnel : sans WebGL, le site garde ses photos. */
(() => {
  "use strict";
  const T = window.THREE;
  if (!T) return;
  const hasGsap = typeof window.gsap !== "undefined";
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  const NOISE = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }`;

  // éclairage de cheveu (Kajiya-Kay) : reflet anisotrope le long de la fibre + second reflet teinté
  const SHADE = `
    vec3 hairLight(vec3 Tg, vec3 V, vec3 L, vec3 base, float gloss) {
      vec3 N = normalize(V - Tg * dot(Tg, V) + vec3(1e-4));
      vec3 H = normalize(L + V);
      float d = sqrt(max(0.0, 1.0 - pow(dot(Tg, L), 2.0)));
      vec3 T1 = normalize(Tg + N * 0.12);
      vec3 T2 = normalize(Tg - N * 0.2);
      float a1 = dot(T1, H), a2 = dot(T2, H);
      float s1 = pow(sqrt(max(0.0, 1.0 - a1 * a1)), 110.0);
      float s2 = pow(sqrt(max(0.0, 1.0 - a2 * a2)), 24.0);
      return base * mix(0.34, 1.0, d) + gloss * (vec3(1.0, 0.95, 0.86) * s1 * 0.6 + base * s2 * 0.55);
    }`;

  const hex = (h) => new T.Color(h);
  const COMB_SVG = '<svg viewBox="0 0 72 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7h60a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6z"/>' +
    Array.from({ length: 12 }, (_, i) => `<path d="M${10 + i * 4.8} 13v${i % 2 ? 11 : 14}"/>`).join("") + "</svg>";
  function tweenColor(target, to, dur) {
    const c = hex(to);
    if (!hasGsap || !dur) { target.copy(c); return; }
    gsap.to(target, { r: c.r, g: c.g, b: c.b, duration: dur, ease: "power3.inOut", overwrite: true });
  }
  function tweenNum(u, to, dur) {
    if (!hasGsap || !dur) { u.value = to; return; }
    gsap.to(u, { value: to, duration: dur, ease: "power3.inOut", overwrite: true });
  }
  function makeRenderer(canvas, opts) {
    try {
      const r = new T.WebGLRenderer(Object.assign({ canvas, antialias: true, powerPreference: "high-performance" }, opts));
      if (!r.getContext()) return null;
      r.setPixelRatio(DPR());
      return r;
    } catch (e) { return null; }
  }
  // une fibre = S segments ; les fibres sont des instances
  function strandGeometry(S) {
    const g = new T.InstancedBufferGeometry();
    const pos = new Float32Array((S + 1) * 3);
    for (let i = 0; i <= S; i++) pos[i * 3] = i / S;
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    const idx = [];
    for (let i = 0; i < S; i++) idx.push(i, i + 1);
    g.setIndex(idx);
    return g;
  }
  // rendu seulement quand visible, et version allégée si l'appareil peine
  function loop(el, step) {
    let visible = false, last = performance.now(), slow = 0, frames = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { rootMargin: "100px" }).observe(el);
    const ctl = { onSlow: null };
    (function tick(now) {
      requestAnimationFrame(tick);
      if (!visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (frames < 120) { frames++; if (dt > 0.024) slow++; if (frames === 120 && slow > 50 && ctl.onSlow) ctl.onSlow(); }
      step(dt);
    })(last);
    return ctl;
  }

  /* =========================================================
     1. HERO — cheveux vivants
     ========================================================= */
  const SHADES = {
    blond:    { root: "#a47c4b", tip: "#f8e5bb", streak: 0.35 },
    cuivre:   { root: "#5c200e", tip: "#d8723a", streak: 0.12 },
    chatain:  { root: "#26180f", tip: "#7a4d31", streak: 0.1 },
    balayage: { root: "#2c1c13", tip: "#e8c590", streak: 0.45 }
  };

  // maskEl : les cheveux ne se dessinent qu'à l'intérieur des lettres de cet élément (le « SUZY » du pied de page)
  function hero({ canvas, title, reduced, mobile, maskEl }) {
    const renderer = makeRenderer(canvas, { alpha: !!maskEl });
    if (!renderer) return null;
    // 1,5 au maximum : la différence ne se voit pas sur des fibres, le gain de fluidité oui
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (maskEl) renderer.setClearColor(0x000000, 0); else renderer.setClearColor(0x1c1410, 1);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.z = 10;

    const N = maskEl ? (mobile ? 1600 : 3200) : (mobile ? 2600 : 5500), S = 20, TRAIL = 16;
    const g = strandGeometry(S);
    // les fibres du fond sont dessinées en premier
    const strands = [];
    for (let n = 0; n < N; n++) strands.push({ x: (Math.random() * 2 - 1) * 0.78, y: Math.random() * 0.6, z: -3.2 + Math.random() * 4.4 });
    strands.sort((a, b) => a.z - b.z);
    const aRoot = new Float32Array(N * 3), aRand = new Float32Array(N * 4), aText = new Float32Array(N * 3);
    strands.forEach((s, n) => {
      aRoot.set([s.x, s.y, s.z], n * 3);
      aRand.set([Math.random(), Math.random(), 0.85 + Math.random() * 0.55, Math.random()], n * 4);
    });
    g.setAttribute("aRoot", new T.InstancedBufferAttribute(aRoot, 3));
    g.setAttribute("aRand", new T.InstancedBufferAttribute(aRand, 4));
    const textAttr = new T.InstancedBufferAttribute(aText, 3);
    g.setAttribute("aText", textAttr);
    g.instanceCount = N;

    const trail = Array.from({ length: TRAIL }, () => new T.Vector4(99, 99, 1, 0));
    const start = SHADES.blond;
    const u = {
      uTime: { value: 0 }, uForm: { value: reduced || maskEl ? 0 : 1 }, uAlpha: { value: reduced || maskEl ? 1 : 0 }, uScroll: { value: 0 },
      uComb: { value: 0 }, uTilt: { value: 0 }, uMask: { value: null }, uUseMask: { value: maskEl ? 1 : 0 }, uRes: { value: new T.Vector2(1, 1) },
      uView: { value: new T.Vector2(10, 6) }, uCamZ: { value: 10 },
      uRootCol: { value: hex(start.root) }, uTipCol: { value: hex(start.tip) }, uStreak: { value: start.streak },
      uRootA: { value: hex(start.root) }, uTipA: { value: hex(start.tip) }, uStreakA: { value: start.streak },
      uWave: { value: 1 }, uWaveO: { value: new T.Vector2(0, 0) },
      uLight: { value: new T.Vector3(0, 0, 0) },
      uTrail: { value: trail }, uTrailS: { value: new Array(TRAIL).fill(0) }
    };
    const mat = new T.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, depthTest: false,
      vertexShader: `
        uniform float uTime, uForm, uAlpha, uScroll, uCamZ, uStreak, uStreakA, uWave, uComb, uTilt;
        uniform vec2 uView, uWaveO;
        uniform vec3 uRootCol, uTipCol, uRootA, uTipA, uLight;
        uniform vec4 uTrail[${TRAIL}];
        uniform float uTrailS[${TRAIL}];
        attribute vec3 aRoot, aText;
        attribute vec4 aRand;
        varying vec3 vCol;
        varying float vA;
        ${NOISE}
        ${SHADE}
        vec3 flowPos(float t) {
          vec3 p = vec3(aRoot.x * uView.x, uView.y * 0.5 + 0.25 + aRoot.y, aRoot.z);
          float L = uView.y * aRand.z;
          float tt = pow(t, 1.35);
          float wind = 0.75 + 0.25 * sin(uTime * 0.32);
          p.y -= t * L;
          // la chevelure ondule comme sous un sèche-cheveux, par mèches
          float clump = floor(aRoot.x * 16.0 + aRoot.z * 2.0);
          p.x += sin(t * 1.9 - uTime * 0.38 + aRoot.x * 1.7 + clump * 0.22) * 0.95 * t * wind + t * t * (1.3 + uTilt * 2.2);
          vec3 q = vec3(clump * 0.29 + t * 0.85, aRoot.z * 0.45, uTime * 0.09);
          p.x += snoise(q) * 1.05 * tt * wind;
          p.z += snoise(q + 11.3) * 0.7 * tt;
          p.y += snoise(q + 23.7) * 0.25 * tt;
          p.x += snoise(vec3(t * 1.8 + aRand.x * 10.0, aRand.y * 30.0, uTime * 0.14)) * 0.06 * tt;
          return p;
        }
        vec3 formPos(float t) {
          float ang = 1.15 + (aRand.w - 0.5) * 1.1;
          vec2 jitter = vec2(sin(uTime * 2.1 + aRand.x * 40.0), cos(uTime * 1.7 + aRand.y * 40.0)) * 0.008;
          return aText + vec3(cos(ang), sin(ang), 0.0) * (t - 0.5) * 0.11 + vec3(jitter, 0.0);
        }
        vec3 hairPos(float t, float k) {
          vec3 p = flowPos(t);
          if (k > 0.0) p = mix(p, formPos(t), k);
          return p;
        }
        // la souris peigne : un fin sillon s'ouvre de part et d'autre de son passage, puis se referme
        vec3 comb(vec3 p, float t) {
          if (uComb < 0.01) return p;
          float w = smoothstep(0.02, 0.3, t);
          vec2 pp = p.xy * (uCamZ / (uCamZ - p.z));
          vec2 off = vec2(0.0);
          for (int i = 0; i < ${TRAIL}; i++) {
            float s = uTrailS[i];
            if (s < 0.01) continue;
            vec2 dir = uTrail[i].zw;
            vec2 nrm = vec2(-dir.y, dir.x);
            vec2 d = pp - uTrail[i].xy;
            float along = dot(d, dir), across = dot(d, nrm);
            off += nrm * sign(across) * s * exp(-along * along / 0.03) * exp(-abs(across) / 0.25) * 0.14;
          }
          p.xy += off * w;
          return p;
        }
        vec3 shade(vec3 root, vec3 tip, float streakAmt, float t) {
          vec3 base = mix(root, tip, smoothstep(0.08, 0.95, t));
          float streak = step(1.0 - streakAmt, fract(aRand.y * 7.13 + floor(aRoot.x * 40.0) * 0.17));
          return mix(base, tip * 1.12, streak * smoothstep(0.12, 0.55, t));
        }
        void main() {
          float t = position.x;
          float t2 = t < 0.95 ? t + 0.05 : t - 0.05;
          float k = uForm > 0.0 ? smoothstep(aRand.x * 0.4 + (1.0 - t) * 0.12, aRand.x * 0.4 + (1.0 - t) * 0.12 + 0.5, uForm) : 0.0;
          vec3 p = comb(hairPos(t, k), t);
          vec3 p2 = comb(hairPos(t2, k), t2);
          vec3 Tg = normalize((p2 - p) * sign(t2 - t) + vec3(0.0, 1e-4, 0.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          vec2 pp = p.xy * (uCamZ / (uCamZ - p.z));

          // la nouvelle teinte se répand en vague depuis la pastille choisie, des racines vers les pointes
          float wd = length(pp - uWaveO) / length(uView) + (aRand.w - 0.5) * 0.05 + t * 0.08;
          float wm = smoothstep(wd, wd + 0.12, uWave * 1.3 - 0.12);
          vec3 base = mix(shade(uRootA, uTipA, uStreakA, t), shade(uRootCol, uTipCol, uStreak, t), wm);
          base *= 0.72 + 0.5 * fract(aRand.x * 13.7);

          vec3 V = vec3(0.0, 0.0, 1.0);
          vec3 c = hairLight(Tg, V, normalize(vec3(sin(uTime * 0.18) * 0.7, 0.65, 0.55)), base, 1.0);
          // le curseur est une petite lampe : le reflet suit la souris
          if (uLight.z > 0.01) {
            vec2 ld = uLight.xy - pp;
            float lf = uLight.z * exp(-dot(ld, ld) / 1.4);
            c += hairLight(Tg, V, normalize(vec3(ld * 0.9, 0.8)), vec3(0.0), 1.0) * lf * 2.2 + base * lf * 0.25;
          }
          c += vec3(1.0, 0.86, 0.6) * wm * (1.0 - wm) * 1.2;
          c = mix(c, vec3(1.0, 0.85, 0.58) * 1.35, k * 0.75);
          float depth = smoothstep(-3.2, 1.2, p.z);
          vCol = c * mix(0.5, 1.15, depth) * (1.0 - uScroll * 0.6);
          vA = uAlpha * mix(1.0, 1.0 - smoothstep(0.8, 1.0, t), 1.0 - k) * mix(0.42, 0.9, depth) * mix(1.0, 1.25, k);
        }`,
      fragmentShader: `
        uniform sampler2D uMask;
        uniform float uUseMask;
        uniform vec2 uRes;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float m = 1.0;
          if (uUseMask > 0.5) { m = texture2D(uMask, gl_FragCoord.xy / uRes).a; if (m < 0.02) discard; }
          gl_FragColor = vec4(vCol, vA * m);
        }`
    });
    const mesh = new T.LineSegments(g, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const view = { w: 10, h: 6 };
    // masque : le mot dessiné à la taille exacte du canvas
    function drawMask() {
      if (!maskEl) return;
      const cr = canvas.getBoundingClientRect(), r = maskEl.getBoundingClientRect();
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      if (!cr.width || !size.x) return;
      const sc = size.x / cr.width;
      const c = document.createElement("canvas");
      c.width = size.x; c.height = size.y;
      const x = c.getContext("2d");
      const cs = getComputedStyle(maskEl);
      x.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * sc}px ${cs.fontFamily}`;
      try { x.letterSpacing = (parseFloat(cs.letterSpacing) || 0) * sc + "px"; } catch (e) { /* ancien navigateur */ }
      x.textAlign = "center";
      x.fillStyle = "#fff";
      const m = x.measureText(maskEl.textContent);
      // le centre optique des capitales, pas celui de la boîte de ligne
      x.textBaseline = "alphabetic";
      const cy = (r.top - cr.top + r.height / 2) * sc + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      x.fillText(maskEl.textContent, (r.left - cr.left + r.width / 2) * sc, cy);
      if (u.uMask.value) u.uMask.value.dispose();
      u.uMask.value = new T.CanvasTexture(c);
      u.uRes.value.set(size.x, size.y);
    }
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      view.h = 2 * camera.position.z * Math.tan((camera.fov / 2) * Math.PI / 180);
      view.w = view.h * camera.aspect;
      u.uView.value.set(view.w, view.h);
      drawMask();
    }
    resize();
    addEventListener("resize", resize);
    const toWorld = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return [((clientX - r.left) / r.width - 0.5) * view.w, -((clientY - r.top) / r.height - 0.5) * view.h];
    };

    // le mot « Suzy » est dessiné exactement là où le titre HTML apparaîtra
    function sampleTitle() {
      const cr = canvas.getBoundingClientRect(), r = title.getBoundingClientRect();
      const txt = title.textContent.trim();
      if (!r.width || !txt) return false;
      const cs = getComputedStyle(title);
      const sc = Math.min(1, 720 / r.width);
      const w = Math.ceil(r.width * sc), h = Math.ceil(r.height * sc);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true });
      const fs = parseFloat(cs.fontSize) * sc;
      x.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      try { x.letterSpacing = (parseFloat(cs.letterSpacing) || 0) * sc + "px"; } catch (e) { /* ancien navigateur */ }
      const m = x.measureText(txt);
      const pt = parseFloat(cs.paddingTop) * sc, pb = parseFloat(cs.paddingBottom) * sc;
      const mid = pt + (h - pt - pb) / 2;
      x.fillStyle = "#fff";
      x.textBaseline = "alphabetic";
      x.fillText(txt, parseFloat(cs.paddingLeft) * sc, mid + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      const data = x.getImageData(0, 0, w, h).data, pts = [];
      for (let py = 0; py < h; py += 2) for (let px = 0; px < w; px += 2) if (data[(py * w + px) * 4 + 3] > 140) pts.push(px, py);
      if (pts.length < 40) return false;
      for (let n = 0; n < N; n++) {
        const k = (Math.random() * (pts.length / 2)) | 0;
        const sx = r.left - cr.left + pts[k * 2] / sc, sy = r.top - cr.top + pts[k * 2 + 1] / sc;
        aText[n * 3] = (sx / cr.width - 0.5) * view.w;
        aText[n * 3 + 1] = -(sy / cr.height - 0.5) * view.h;
        aText[n * 3 + 2] = 0;
      }
      textAttr.needsUpdate = true;
      return true;
    }

    // souris / doigt : on mémorise le trajet par petits pas pour tracer un sillon continu
    let head = 0, lastX = null, lastY = null;
    const light = { x: 0, y: 0, on: 0, tx: 0, ty: 0, ton: 0 };
    function addPoint(x, y, dx, dy) {
      head = (head + 1) % TRAIL;
      const l = Math.hypot(dx, dy) || 1;
      trail[head].set(x, y, dx / l, dy / l);
      u.uTrailS.value[head] = 1;
    }
    function combTo(x, y) {
      if (lastX === null) { lastX = x; lastY = y; return; }
      const dx = x - lastX, dy = y - lastY, dist = Math.hypot(dx, dy);
      if (dist < 0.09) return;
      const steps = Math.min(Math.ceil(dist / 0.09), 6);
      for (let i = 1; i <= steps; i++) addPoint(lastX + dx * i / steps, lastY + dy * i / steps, dx, dy);
      lastX = x; lastY = y;
    }
    function pointer(clientX, clientY) {
      const [x, y] = toWorld(clientX, clientY);
      light.tx = x; light.ty = y; light.ton = 1;
      combTo(x, y);
    }
    const host = maskEl ? canvas.parentElement : (canvas.closest("section") || canvas);
    host.addEventListener("pointermove", (e) => pointer(e.clientX, e.clientY), { passive: true });
    host.addEventListener("touchmove", (e) => { const tc = e.touches[0]; if (tc) pointer(tc.clientX, tc.clientY); }, { passive: true });
    host.addEventListener("pointerleave", () => { lastX = null; light.ton = 0; });

    let time = 0;
    function render() { renderer.render(scene, camera); }
    const ctl = loop(host, (dt) => {
      if (reduced) return;
      time += dt;
      u.uTime.value = time;
      // le sillon se referme en un peu plus d'une seconde
      const s = u.uTrailS.value, fall = Math.pow(0.12, dt);
      let mx = 0;
      for (let i = 0; i < TRAIL; i++) { s[i] *= fall; if (s[i] > mx) mx = s[i]; }
      u.uComb.value = mx;
      tilt.v += (tilt.t - tilt.v) * (1 - Math.pow(0.05, dt));
      u.uTilt.value = tilt.v;
      const e = 1 - Math.pow(0.002, dt);
      light.x += (light.tx - light.x) * e; light.y += (light.ty - light.y) * e; light.on += (light.ton - light.on) * e * 0.5;
      u.uLight.value.set(light.x, light.y, light.on);
      render();
    });
    ctl.onSlow = () => { g.instanceCount = Math.floor(N * 0.55); renderer.setPixelRatio(1); resize(); };

    // téléphone : la chevelure suit l'inclinaison (sur iPhone, autorisation demandée au premier toucher)
    const tilt = { v: 0, t: 0 };
    if (mobile && !reduced && window.DeviceOrientationEvent) {
      const onTilt = (e) => { if (e.gamma !== null) tilt.t = Math.max(-1, Math.min(1, e.gamma / 35)); };
      const listen = () => addEventListener("deviceorientation", onTilt);
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const ask = (e) => {
          if (e.target.closest("a, button")) return;
          host.removeEventListener("touchend", ask);
          DeviceOrientationEvent.requestPermission().then((r) => { if (r === "granted") listen(); }).catch(() => {});
        };
        host.addEventListener("touchend", ask);
      } else listen();
    }

    // démonstration : une brosse invisible passe une fois dans les cheveux
    function demoComb() {
      const r = canvas.getBoundingClientRect();
      if (!hasGsap || !r.width) return;
      const ghost = document.createElement("div");
      ghost.className = "comb-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.innerHTML = COMB_SVG;
      host.appendChild(ghost);
      const p = { k: 0 };
      const a = [r.width * 0.18, r.height * 0.3], b = [r.width * 0.78, r.height * 0.52];
      gsap.timeline({ onComplete: () => { ghost.remove(); lastX = null; light.ton = 0; } })
        .fromTo(ghost, { opacity: 0 }, { opacity: 1, duration: .4 })
        .to(p, {
          k: 1, duration: 1.6, ease: "power2.inOut",
          onUpdate() {
            const x = a[0] + (b[0] - a[0]) * p.k, y = a[1] + (b[1] - a[1]) * p.k + Math.sin(p.k * Math.PI) * -r.height * 0.06;
            ghost.style.transform = `translate(${x}px, ${y}px) rotate(${-8 + p.k * 16}deg)`;
            pointer(r.left + x, r.top + y);
          }
        }, "<")
        .to(ghost, { opacity: 0, duration: .5 }, "-=.4");
    }

    const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    const ready = fontsReady.then(() => {
      if (maskEl) drawMask();
      else if (!reduced && !sampleTitle()) u.uForm.value = 0;
      render();
      host.classList.add("has-gl");
    });

    return {
      ready,
      shades: Object.keys(SHADES),
      shade: "blond",
      // apparition : les fibres écrivent « Suzy », puis se détachent et deviennent chevelure
      start() {
        if (reduced || !hasGsap) { u.uAlpha.value = 1; u.uForm.value = 0; render(); return 0; }
        gsap.to(u.uAlpha, { value: 1, duration: 1.4, ease: "power2.out" });
        gsap.to(u.uForm, { value: 0, duration: 3.4, delay: 1.5, ease: "power3.inOut", onComplete: () => { if (!mobile) demoComb(); } });
        return 2.1;
      },
      setShade(key, clientX, clientY) {
        const s = SHADES[key];
        if (!s || key === this.shade) return;
        this.shade = key;
        u.uRootA.value.copy(u.uRootCol.value);
        u.uTipA.value.copy(u.uTipCol.value);
        u.uStreakA.value = u.uStreak.value;
        u.uRootCol.value.copy(hex(s.root));
        u.uTipCol.value.copy(hex(s.tip));
        u.uStreak.value = s.streak;
        if (clientX !== undefined) u.uWaveO.value.set(...toWorld(clientX, clientY));
        if (reduced || !hasGsap) { u.uWave.value = 1; render(); return; }
        gsap.fromTo(u.uWave, { value: 0 }, { value: 1, duration: 1.6, ease: "power2.inOut", overwrite: true });
      },
      setScroll(p) { u.uScroll.value = p; },
      color(key) { return SHADES[key] && SHADES[key].tip; }
    };
  }

  /* =========================================================
     2. ESSAYEZ VOTRE COULEUR — une mèche en 3D
     ========================================================= */
  const MODES = {
    balayage: { root: "#3a2519", tip: "#dcb57c", g0: 0.3, g1: 0.85, streak: 0.18, streakCol: "#efd6a6", sf: 0.35, gloss: 1.0 },
    airtouch: { root: "#4b3324", tip: "#ead3a8", g0: 0.12, g1: 0.55, streak: 0.55, streakCol: "#f7e9cb", sf: 0.08, gloss: 1.1 },
    gloss:    { root: "#3b2318", tip: "#5f3c27", g0: 0.2, g1: 1.0, streak: 0.0, streakCol: "#6b4430", sf: 1.0, gloss: 2.6 },
    cuivre:   { root: "#6a2611", tip: "#d27840", g0: 0.1, g1: 0.9, streak: 0.14, streakCol: "#f2a463", sf: 0.3, gloss: 1.4 }
  };

  function lock({ canvas, reduced, mobile }) {
    const renderer = makeRenderer(canvas, { alpha: true });
    if (!renderer) return null;
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 40);
    camera.position.set(0, 0, 8.2);
    const N = mobile ? 1500 : 2800, S = 56;
    const g = strandGeometry(S);
    const aOff = new Float32Array(N * 2), aRand = new Float32Array(N * 4);
    for (let n = 0; n < N; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      aOff.set([Math.cos(a) * r, Math.sin(a) * r], n * 2);
      aRand.set([Math.random(), Math.random(), Math.random(), Math.random()], n * 4);
    }
    g.setAttribute("aOff", new T.InstancedBufferAttribute(aOff, 2));
    g.setAttribute("aRand", new T.InstancedBufferAttribute(aRand, 4));
    g.instanceCount = N;
    const m0 = MODES.balayage;
    const u = {
      uTime: { value: 0 }, uRoot: { value: hex(m0.root) }, uTip: { value: hex(m0.tip) }, uStreakCol: { value: hex(m0.streakCol) },
      uG0: { value: m0.g0 }, uG1: { value: m0.g1 }, uStreak: { value: m0.streak }, uSF: { value: m0.sf }, uGloss: { value: m0.gloss },
      uRootA: { value: hex(m0.root) }, uTipA: { value: hex(m0.tip) }, uStreakColA: { value: hex(m0.streakCol) },
      uParA: { value: new T.Vector4(m0.g0, m0.g1, m0.streak, m0.sf) }, uFlow: { value: 1 }
    };
    const mat = new T.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `
        uniform float uTime, uG0, uG1, uStreak, uSF, uGloss, uFlow;
        uniform vec3 uRoot, uTip, uStreakCol, uRootA, uTipA, uStreakColA;
        uniform vec4 uParA;
        attribute vec2 aOff;
        attribute vec4 aRand;
        varying vec3 vCol;
        varying float vA;
        ${NOISE}
        ${SHADE}
        vec3 lockPos(float t) {
          float ang = t * 8.5 + 0.6;
          float R = 0.05 + 0.4 * smoothstep(0.05, 0.55, t) * (1.0 - 0.25 * t);
          vec3 c = vec3(sin(ang) * R, 1.75 - t * 3.7, cos(ang) * R);
          float w = (0.27 * (1.0 - 0.8 * pow(t, 1.2)) + 0.015) * mix(0.55, 1.0, smoothstep(0.0, 0.18, t));
          float tw = t * 2.2;
          vec2 o = vec2(aOff.x * cos(tw) - aOff.y * sin(tw), aOff.x * sin(tw) + aOff.y * cos(tw)) * w;
          vec3 p = c + vec3(o.x, 0.0, o.y);
          float fly = smoothstep(0.86, 1.0, aRand.z);
          vec3 q = vec3(t * 2.5 + aRand.x * 9.0, aRand.y * 7.0, uTime * 0.25);
          p += vec3(snoise(q), snoise(q + 7.1) * 0.4, snoise(q + 13.7)) * (0.022 + fly * 0.13) * t;
          p.x += sin(uTime * 0.9 + t * 2.4) * 0.05 * t * t;
          return p;
        }
        vec3 colour(vec3 root, vec3 tip, vec3 sc, vec4 par, float t) {
          vec3 base = mix(root, tip, smoothstep(par.x, par.y, t));
          float s = step(1.0 - par.z, aRand.y);
          return mix(base, sc, s * smoothstep(par.w, par.w + 0.25, t));
        }
        void main() {
          float t = position.x;
          float t2 = min(t + 0.03, 1.0), t1 = t2 - 0.03;
          vec4 mv = modelViewMatrix * vec4(lockPos(t), 1.0);
          vec3 Tg = normalize((modelViewMatrix * vec4(lockPos(t2), 1.0)).xyz - (modelViewMatrix * vec4(lockPos(t1), 1.0)).xyz);
          gl_Position = projectionMatrix * mv;
          float wm = smoothstep(t, t + 0.15, uFlow * 1.3 - 0.15);
          vec3 base = mix(colour(uRootA, uTipA, uStreakColA, uParA, t), colour(uRoot, uTip, uStreakCol, vec4(uG0, uG1, uStreak, uSF), t), wm);
          base *= 0.8 + 0.4 * aRand.x;
          base += vec3(1.0, 0.88, 0.66) * wm * (1.0 - wm) * 0.9;
          vec3 V = normalize(-mv.xyz);
          vec3 c = hairLight(Tg, V, normalize(vec3(-0.5, 0.7, 0.6)), base, uGloss);
          c += hairLight(Tg, V, normalize(vec3(0.8, 0.1, -0.3)), base, uGloss * 0.5) * 0.25;
          vCol = min(c, vec3(0.92)) * mix(1.0, 0.8, smoothstep(0.7, 1.0, t));
          vA = 0.85 * mix(1.0, 0.3, smoothstep(0.55, 1.0, t)) * (1.0 - smoothstep(0.9, 1.0, t)) * smoothstep(0.0, 0.14 + aRand.w * 0.1, t);
        }`,
      fragmentShader: `
        varying vec3 vCol;
        varying float vA;
        void main() { gl_FragColor = vec4(vCol, vA); }`
    });
    const mesh = new T.LineSegments(g, mat);
    mesh.frustumCulled = false;
    const pivot = new T.Group();
    pivot.add(mesh);
    scene.add(pivot);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // la mèche entière reste dans le cadre, même en format étroit
      camera.position.z = camera.aspect < 0.75 ? 7.3 / Math.max(camera.aspect / 0.75, 0.55) : 7.3;
      camera.updateProjectionMatrix();
    }
    resize();
    addEventListener("resize", resize);

    // on fait tourner la mèche à la souris ou au doigt
    let rotY = 0.4, velY = 0, tiltX = 0, dragging = false, px = 0, idle = 0;
    canvas.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; idle = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      tiltX = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
      if (!dragging) return;
      velY = (e.clientX - px) * 0.008;
      px = e.clientX;
    });
    const stop = () => { dragging = false; };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerleave", () => { tiltX = 0; });

    let time = 0;
    const spin = { v: 0 };
    const render = () => renderer.render(scene, camera);
    const ctl = loop(canvas, (dt) => {
      if (reduced) return;
      time += dt;
      u.uTime.value = time;
      idle += dt;
      if (!dragging) velY *= Math.pow(0.04, dt);
      rotY += velY + (idle > 0.6 ? dt * 0.3 : 0);
      pivot.rotation.y = rotY + spin.v;
      pivot.rotation.x += (tiltX - pivot.rotation.x) * 0.06;
      render();
    });
    ctl.onSlow = () => { g.instanceCount = Math.floor(N * 0.55); renderer.setPixelRatio(1); resize(); };
    pivot.rotation.y = rotY;
    render();

    return {
      setMode(key) {
        const m = MODES[key];
        if (!m) return;
        // l'ancienne couleur reste, la nouvelle coule des racines vers les pointes
        u.uRootA.value.copy(u.uRoot.value);
        u.uTipA.value.copy(u.uTip.value);
        u.uStreakColA.value.copy(u.uStreakCol.value);
        u.uParA.value.set(u.uG0.value, u.uG1.value, u.uStreak.value, u.uSF.value);
        u.uRoot.value.copy(hex(m.root));
        u.uTip.value.copy(hex(m.tip));
        u.uStreakCol.value.copy(hex(m.streakCol));
        u.uG0.value = m.g0; u.uG1.value = m.g1; u.uStreak.value = m.streak; u.uSF.value = m.sf;
        if (reduced || !hasGsap) { u.uFlow.value = 1; u.uGloss.value = m.gloss; render(); return; }
        gsap.to(u.uGloss, { value: m.gloss, duration: 1.8, ease: "power3.inOut", overwrite: true });
        gsap.fromTo(u.uFlow, { value: 0 }, { value: 1, duration: 1.9, ease: "power2.inOut", overwrite: true });
        gsap.fromTo(spin, { v: 0 }, { v: Math.PI * 2, duration: 1.9, ease: "power3.inOut", overwrite: true });
        idle = 0;
      },
      swatch(key) { return MODES[key] && [MODES[key].root, MODES[key].tip]; }
    };
  }

  /* =========================================================
     3. AVANT / APRÈS — transition liquide
     ========================================================= */
  function liquidBA({ frame, range, reduced }) {
    const canvas = document.createElement("canvas");
    canvas.className = "ba-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const renderer = makeRenderer(canvas, { alpha: false, antialias: false });
    if (!renderer) return null;
    frame.insertBefore(canvas, frame.querySelector(".ba-tag"));
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const V2 = T.Vector2;
    const u = {
      uA: { value: null }, uB: { value: null }, uImgA: { value: new V2(4, 5) }, uImgB: { value: new V2(4, 5) },
      uA0: { value: null }, uB0: { value: null }, uImgA0: { value: new V2(4, 5) }, uImgB0: { value: new V2(4, 5) }, uSwap: { value: 1 },
      uRes: { value: new V2(4, 5) }, uPos: { value: 0.5 }, uTime: { value: 0 }, uVel: { value: 0 }
    };
    scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        precision highp float;
        uniform sampler2D uA, uB, uA0, uB0;
        uniform vec2 uImgA, uImgB, uImgA0, uImgB0, uRes;
        uniform float uPos, uTime, uVel, uSwap;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 w = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
        }
        float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
        vec2 cover(vec2 uv, vec2 img) {
          float ra = uRes.x / uRes.y, ia = img.x / img.y;
          vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
          return (uv - 0.5) * s + 0.5;
        }
        void main() {
          vec2 uv = vUv;
          float n = fbm(vec2(uv.x * 2.2, uv.y * 3.4) + vec2(0.0, uTime * 0.07));
          float v = uv.x + (n - 0.5) * 0.3;
          float w = 0.06 + min(abs(uVel) * 0.6, 0.12);
          float m = smoothstep(uPos - w, uPos + w, v);
          float band = 1.0 - abs(m * 2.0 - 1.0);
          vec2 disp = vec2((n - 0.5) * 0.14, sin(uv.y * 13.0 + uTime * 1.3 + n * 6.0) * 0.03) * band;
          vec3 col = mix(texture2D(uA, cover(uv + disp, uImgA)).rgb, texture2D(uB, cover(uv - disp, uImgB)).rgb, m);
          // changement de transformation : l'ancienne paire fond dans la nouvelle
          if (uSwap < 1.0) {
            float n2 = fbm(uv * 3.0 + 7.0);
            float sw = smoothstep(n2 - 0.12, n2 + 0.12, uSwap * 1.3 - 0.15);
            float sb = 1.0 - abs(sw * 2.0 - 1.0);
            vec2 d2 = vec2(n2 - 0.5, sin(uv.y * 9.0 + uTime) * 0.5) * sb * 0.08;
            vec3 old = mix(texture2D(uA0, cover(uv + disp + d2, uImgA0)).rgb, texture2D(uB0, cover(uv - disp + d2, uImgB0)).rgb, m);
            col = mix(old, col, sw);
            col += vec3(1.0, 0.88, 0.7) * pow(sb, 2.0) * 0.18;
          }
          col += vec3(1.0, 0.9, 0.74) * pow(band, 3.0) * 0.2 * (0.6 + 0.4 * sin(uv.y * 28.0 + uTime * 2.0 + n * 10.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    })));

    function resize() {
      const r = frame.getBoundingClientRect();
      if (!r.width) return;
      renderer.setSize(r.width, r.height, false);
      u.uRes.value.set(r.width, r.height);
    }
    resize();
    addEventListener("resize", resize);

    const loader = new T.TextureLoader();
    const load = (src) => new Promise((res) => loader.load(src, (tx) => { tx.minFilter = T.LinearFilter; tx.generateMipmaps = false; res(tx); }, undefined, () => res(null)));
    function setPair(before, after) {
      return Promise.all([load(before), load(after)]).then(([a, b]) => {
        if (!a || !b) return;
        if (u.uA.value && !reduced && hasGsap) {
          u.uA0.value = u.uA.value; u.uB0.value = u.uB.value;
          u.uImgA0.value.copy(u.uImgA.value); u.uImgB0.value.copy(u.uImgB.value);
          gsap.fromTo(u.uSwap, { value: 0 }, { value: 1, duration: 1.4, ease: "power2.inOut", overwrite: true });
        }
        u.uA.value = a; u.uB.value = b;
        u.uImgA.value.set(a.image.width, a.image.height);
        u.uImgB.value.set(b.image.width, b.image.height);
        frame.classList.add("ba-gl");
      });
    }
    setPair(frame.querySelector(".ba-before").src, frame.querySelector(".ba-after").src);
    document.addEventListener("ba:pair", (e) => setPair(e.detail.before, e.detail.after));

    // la souris tient le front ; sans souris, c'est le défilement qui le fait glisser
    let hover = false, touched = 0;
    const setTarget = (p) => { range.value = Math.round(p * 1000) / 10; frame.style.setProperty("--pos", range.value + "%"); };
    frame.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = frame.getBoundingClientRect();
      hover = true;
      setTarget(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1));
    });
    frame.addEventListener("pointerleave", () => { hover = false; });
    range.addEventListener("input", () => { touched = performance.now(); });
    function fromScroll() {
      if (hover || performance.now() - touched < 2500) return;
      const r = frame.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
      setTarget(0.94 - 0.88 * Math.min(Math.max((p - 0.2) / 0.5, 0), 1));
    }
    if (!reduced) addEventListener("scroll", fromScroll, { passive: true });

    let time = 0;
    loop(frame, (dt) => {
      if (!u.uA.value) return;
      time += dt;
      u.uTime.value = reduced ? 0 : time;
      const target = (+range.value || 0) / 100;
      const prev = u.uPos.value;
      u.uPos.value += (target - prev) * (reduced ? 1 : 1 - Math.pow(0.002, dt));
      u.uVel.value += ((u.uPos.value - prev) / Math.max(dt, 0.001) * 0.05 - u.uVel.value) * 0.2;
      renderer.render(scene, camera);
    });
    return { setPair };
  }

  window.SuzyGL = { hero, lock, liquidBA, SHADES, MODES };
})();
