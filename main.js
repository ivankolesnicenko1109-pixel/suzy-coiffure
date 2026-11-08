(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  let heroGL = null;

  /* ---------- i18n ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
  };
  let lang = store.get("suzy-lang");
  if (!I18N[lang]) lang = "fr";
  const t = (k) => (I18N[lang][k] ?? I18N.fr[k] ?? "");
  const LANG_INDEX = { fr: 0, en: 1, de: 2 };

  function applyLang(next) {
    lang = next;
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$(".reveal-lines").forEach(splitWords);
    $$(".lang button").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === lang));
    renderServices();
    renderReviews();
    renderHours();
    renderPairs();
    $$(".count").forEach((el) => { if (el.dataset.done) el.textContent = formatCount(+el.dataset.to, +el.dataset.dec || 0); });
    if (heroGL) heroGL.relabel();
    store.set("suzy-lang", lang);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  function splitWords(el) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const i = document.createElement("span");
            i.className = "wi";
            i.textContent = part;
            w.appendChild(i);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  }

  /* ---------- Prestations ---------- */
  let activeCat = SERVICES[0].id;
  const fmtPrice = (p) => typeof p === "number" ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : p;
  const priceHtml = (price, from) => price === null
    ? `<b class="srv-free">${t("srv.free")}</b>`
    : `${from ? `<small>${t("srv.from")}</small>` : ""}<b>${fmtPrice(price)}</b> CHF`;

  function renderServices() {
    const tabs = $("#srvTabs");
    tabs.innerHTML = "";
    SERVICES.forEach((cat) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "srv-tab";
      b.id = "tab-" + cat.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(cat.id === activeCat));
      b.textContent = cat.label[lang];
      b.addEventListener("click", () => { activeCat = cat.id; renderServices(); animateServiceList(); });
      tabs.appendChild(b);
    });
    const cat = SERVICES.find((c) => c.id === activeCat);
    const list = $("#srvList");
    list.innerHTML = cat.items.map(([names, price, from]) => `
      <li class="srv-item">
        <span class="srv-name">${Array.isArray(names) ? names[LANG_INDEX[lang]] : names}</span>
        <span class="srv-dots" aria-hidden="true"></span>
        <span class="srv-price">${priceHtml(price, from)}</span>
      </li>`).join("");
    const img = $("#srvImg");
    if (!img.src.endsWith(cat.img)) img.src = cat.img;
    $("#srvLabel").textContent = cat.label[lang];
  }
  function animateServiceList() {
    if (!hasGsap || reduced) return;
    gsap.from("#srvList .srv-item", { y: 24, opacity: 0, duration: .8, stagger: .06, ease: "expo.out" });
    gsap.fromTo("#srvImg", { scale: 1.15, opacity: .4 }, { scale: 1, opacity: 1, duration: 1.2, ease: "expo.out" });
  }

  /* ---------- Avis ---------- */
  function renderReviews() {
    const card = ([text, who]) => `<article class="rev-card"><p>${text}</p><div class="rev-meta"><span class="stars">★★★★★</span><span>${who} · Salonkee</span></div></article>`;
    const html = REVIEWS.map(card).join("");
    $("#revTrack").innerHTML = html + html.replace(/<article /g, '<article aria-hidden="true" ');
  }

  /* ---------- Avant / après : choix de la transformation ---------- */
  let activePair = 0;
  function renderPairs() {
    const box = $("#baPairs");
    box.innerHTML = BA_PAIRS.map((p, i) => `<button type="button" class="ba-pair" aria-pressed="${i === activePair}"><img src="${p.after}" alt="" loading="lazy"><span>${p.label[lang]}</span></button>`).join("");
    $$(".ba-pair", box).forEach((b, i) => b.addEventListener("click", () => {
      activePair = i;
      $(".ba-before").src = BA_PAIRS[i].before;
      $(".ba-after").src = BA_PAIRS[i].after;
      $(".ba-after").alt = BA_PAIRS[i].label[lang];
      renderPairs();
    }));
  }

  /* ---------- Horaires ---------- */
  function renderHours() {
    const now = new Date();
    const today = now.getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = t("days");
    $("#hoursList").innerHTML = order.map((d) => {
      const h = HOURS[d];
      const val = h ? `${h[0]} – ${h[1]}` : `<span class="off">${t("info.closed")}</span>`;
      return `<li class="${d === today ? "is-today" : ""}"><span>${days[d]}</span><span>${val}</span></li>`;
    }).join("");
    const h = HOURS[today];
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (s) => { const [a, b] = s.split(":").map(Number); return a * 60 + b; };
    const open = !!h && mins >= toMin(h[0]) && mins < toMin(h[1]);
    const st = $("#openStatus");
    st.className = "status " + (open ? "open" : "closed");
    st.textContent = open ? t("info.openNow") : t("info.closedNow");
  }

  /* ---------- Compteurs ---------- */
  function formatCount(v, dec) {
    return dec ? v.toFixed(dec).replace(".", lang === "en" ? "." : ",") : String(Math.round(v));
  }

  /* ---------- Titre hero découpé en lettres ---------- */
  $$("[data-split]").forEach((el) => {
    el.innerHTML = el.textContent.split("").map((c) => `<span class="ch">${c === " " ? "&nbsp;" : c}</span>`).join("");
  });

  applyLang(lang);
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Lenis (scroll doux) ---------- */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    if (hasGsap) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -70, duration: 1.6 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  }));

  /* ---------- Navigation ---------- */
  const nav = $("#nav");
  let lastY = 0;
  const onScroll = (y) => {
    nav.classList.toggle("is-scrolled", y > 40);
    lastY = y;
  };
  if (lenis) lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  else addEventListener("scroll", () => onScroll(scrollY), { passive: true });

  const burger = $("#burger");
  const menu = $("#mobileMenu");
  function closeMenu() { menu.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    nav.classList.add("is-scrolled");
  });

  /* ---------- Curseur + boutons magnétiques ---------- */
  if (finePointer && !reduced) {
    const cur = $("#cursor");
    const label = $("#cursorLabel");
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });
    (function loop() {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const hov = e.target.closest("a, button, input, .tilt");
      cur.classList.toggle("is-label", !!lab);
      label.textContent = lab ? lab.dataset.cursor : "";
      cur.classList.toggle("is-hover", !lab && !!hov);
    });

    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
      el.style.transition = "transform .5s cubic-bezier(.16,1,.3,1), background .5s, box-shadow .5s, color .5s, border-color .5s";
    });

    $$(".tilt").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateY(-6px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- Hero : le titre suit doucement la souris ---------- */
  if (finePointer && !reduced && hasGsap) {
    const heroEl = $("#hero");
    const tx = gsap.quickTo(".hero-title", "x", { duration: 1.6, ease: "power3" });
    const ty = gsap.quickTo(".hero-title", "y", { duration: 1.6, ease: "power3" });
    heroEl.addEventListener("pointermove", (e) => {
      const r = heroEl.getBoundingClientRect();
      tx(((e.clientX - r.left) / r.width - 0.5) * 30);
      ty(((e.clientY - r.top) / r.height - 0.5) * 14);
    });
    heroEl.addEventListener("pointerleave", () => { tx(0); ty(0); });
  }

  /* ---------- Avant / Après ---------- */
  const baFrame = $("#baFrame");
  const baRange = $("#baRange");
  baRange.addEventListener("input", () => baFrame.style.setProperty("--pos", baRange.value + "%"));

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox");
  $$(".gal-item").forEach((fig) => fig.addEventListener("click", () => {
    const img = $("img", fig);
    $("#lbImg").src = img.src;
    $("#lbImg").alt = img.alt;
    $("#lbCap").textContent = img.alt;
    lb.hidden = false;
    if (lenis) lenis.stop();
    if (hasGsap) gsap.fromTo("#lbImg", { scale: .92, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, ease: "expo.out" });
  }));
  const closeLb = () => { lb.hidden = true; if (lenis) lenis.start(); };
  $("#lbClose").addEventListener("click", closeLb);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  /* ---------- Copier le numéro ---------- */
  $("#copyPhone").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const done = () => { btn.textContent = t("info.copied"); setTimeout(() => (btn.textContent = t("info.copy")), 2200); };
    const fallback = () => {
      const r = document.createRange();
      r.selectNodeContents($(".phone"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    try {
      navigator.clipboard.writeText("+41 76 321 32 39").then(done, fallback);
    } catch (err) { fallback(); }
  });

  /* =========================================================
     HERO — diaporama cinéma en WebGL
     transitions « or liquide » + distorsion fluide à la souris
     ========================================================= */
  const SLIDES = [
    { img: "assets/img/work/hero-blond.jpg", name: { fr: "Ondulations blondes", en: "Blonde waves", de: "Blonde Wellen" } },
    { img: "assets/img/work/hero-cuivre.jpg", name: { fr: "Cuivré lumineux", en: "Luminous copper", de: "Leuchtendes Kupfer" } },
    { img: "assets/img/work/hero-boucles.jpg", name: { fr: "Boucles définies", en: "Defined curls", de: "Definierte Locken" } },
    { img: "assets/img/work/hero-wave.jpg", name: { fr: "Brushing wave", en: "Wave blow-dry", de: "Wave-Brushing" } }
  ];
  heroGL = initHeroGL();

  function initHeroGL() {
    const canvas = $("#heroCanvas");
    if (!window.THREE || !canvas) return null;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    } catch (e) { return null; }
    $("#hero").classList.add("has-gl");
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0f0a08, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const V2 = THREE.Vector2;
    const uniforms = {
      uTex1: { value: null }, uTex2: { value: null },
      uImg1: { value: new V2(16, 9) }, uImg2: { value: new V2(16, 9) },
      uRes: { value: new V2(1, 1) },
      uMouse: { value: new V2(0.5, 0.5) }, uVel: { value: new V2() }, uShift: { value: new V2() },
      uHover: { value: 0 }, uProgress: { value: 0 }, uTime: { value: 0 },
      uIntro: { value: reduced ? 1 : 0 }, uZoom1: { value: 1 }, uZoom2: { value: 1 }, uScroll: { value: 0 }
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTex1, uTex2;
        uniform vec2 uImg1, uImg2, uRes, uMouse, uVel, uShift;
        uniform float uHover, uProgress, uTime, uIntro, uZoom1, uZoom2, uScroll;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }
        vec2 cover(vec2 uv, vec2 img, float zoom) {
          float ra = uRes.x / uRes.y, ia = img.x / img.y;
          vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
          return (uv - 0.5) * s / zoom + 0.5 + uShift;
        }
        vec3 sampleRGB(sampler2D t, vec2 uv, float ca) {
          return vec3(texture2D(t, uv + vec2(ca, 0.0)).r, texture2D(t, uv).g, texture2D(t, uv - vec2(ca, 0.0)).b);
        }
        void main() {
          vec2 uv = vUv;
          vec2 asp = vec2(uRes.x / uRes.y, 1.0);
          vec2 d = (uv - uMouse) * asp;
          float dist = length(d);
          float fall = smoothstep(0.42, 0.0, dist) * uHover;

          // la souris pousse l'image comme un liquide
          vec2 duv = uv - uVel * fall * 1.4;
          duv += normalize(d + 1e-5) / asp * sin(dist * 36.0 - uTime * 3.0) * 0.0022 * fall;

          // transition : brûlure dorée dans un bruit organique
          float w = 0.09;
          float n = clamp((fbm(uv * vec2(2.4, 1.7) + vec2(uTime * 0.02, 0.0)) - 0.18) / 0.64, 0.0, 1.0);
          n = n * 0.82 + (1.0 - uv.x) * 0.1 + uv.y * 0.08;
          float tp = uProgress * (1.0 + 2.0 * w) - w;
          float mixv = 1.0 - smoothstep(tp - w, tp + w, n);
          float glow = (1.0 - smoothstep(0.0, w * 0.5, abs(n - tp))) * sin(uProgress * 3.14159);

          float zs = 1.0 + uScroll * 0.15;
          vec2 uv1 = cover(duv + (n - 0.5) * 0.07 * uProgress, uImg1, uZoom1 * zs);
          vec2 uv2 = cover(duv - (n - 0.5) * 0.07 * (1.0 - uProgress), uImg2, uZoom2 * zs);
          float ca = fall * clamp(length(uVel) * 1.2, 0.0, 0.012) + glow * 0.004;
          vec3 col = mix(sampleRGB(uTex1, uv1, ca), sampleRGB(uTex2, uv2, ca), mixv);

          vec3 gold = vec3(1.0, 0.78, 0.46);
          col += gold * glow * 1.25;

          // étalonnage chaud, contraste doux
          col = pow(col, vec3(1.06)) * vec3(1.04, 0.99, 0.93);

          // apparition : l'image se révèle depuis le noir par une flamme d'or
          float n2 = clamp((fbm(uv * 3.0 + 7.0) - 0.18) / 0.64, 0.0, 1.0) * 0.85 + uv.x * 0.15;
          float ti = uIntro * (1.0 + 2.0 * w) - w;
          float show = 1.0 - smoothstep(ti - w, ti + w, n2);
          float gI = (1.0 - smoothstep(0.0, w * 0.45, abs(n2 - ti))) * sin(uIntro * 3.14159);
          col = col * show + gold * gI * 0.95;

          col *= 1.0 - uScroll * 0.55;
          float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.15, 1.0)));
          col *= mix(0.62, 1.0, vig);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    }
    resize();
    addEventListener("resize", resize);

    // textures
    const texs = [], sizes = [];
    const tl = new THREE.TextureLoader();
    const ready = Promise.all(SLIDES.map((s, i) => new Promise((res) => {
      tl.load(s.img, (t) => {
        t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
        texs[i] = t; sizes[i] = new V2(t.image.width, t.image.height); res();
      }, undefined, () => res());
    }))).then(() => {
      uniforms.uTex1.value = texs[0]; uniforms.uImg1.value.copy(sizes[0]);
      uniforms.uTex2.value = texs[1] || texs[0]; uniforms.uImg2.value.copy(sizes[1] || sizes[0]);
    });

    // souris
    const heroEl = $("#hero");
    const target = new V2(0.5, 0.5), prev = new V2(0.5, 0.5);
    let hoverT = 0;
    heroEl.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      hoverT = 1;
    });
    heroEl.addEventListener("pointerleave", () => { hoverT = 0; });

    // zoom lent par image (effet Ken Burns)
    const zooms = SLIDES.map(() => ({ v: 1.0 }));
    let cur = 0, next = 1;
    const kenBurns = (i) => { if (hasGsap) gsap.fromTo(zooms[i], { v: 1.16 }, { v: 1.0, duration: 10, ease: "power2.out" }); };

    let visible = true, running = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(heroEl);
    const clock = new THREE.Clock();
    let time = 0;
    const vel = new V2();
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!visible) return;
      time += dt;
      uniforms.uTime.value = time;
      const m = uniforms.uMouse.value;
      prev.copy(m);
      m.lerp(target, 0.12);
      vel.set(m.x - prev.x, m.y - prev.y).multiplyScalar(5);
      if (vel.length() > 0.09) vel.setLength(0.09);
      uniforms.uVel.value.lerp(vel, 0.12);
      uniforms.uHover.value += (hoverT - uniforms.uHover.value) * 0.05;
      uniforms.uShift.value.set((m.x - 0.5) * -0.012, (m.y - 0.5) * -0.008);
      uniforms.uZoom1.value = zooms[cur].v;
      uniforms.uZoom2.value = zooms[next].v;
      renderer.render(scene, camera);
    }
    if (reduced) ready.then(() => renderer.render(scene, camera));
    else frame();

    // diaporama
    const nav = $("#slidesNav");
    nav.innerHTML = SLIDES.map((s, i) => `<button type="button" class="sn" role="tab" aria-label="${String(i + 1).padStart(2, "0")}"><span class="sn-fill"></span></button>`).join("");
    const btns = $$(".sn", nav);
    let busy = false, auto = null;
    function label(i, animate) {
      $("#slideNum").textContent = String(i + 1).padStart(2, "0");
      $("#slideLabel").textContent = SLIDES[i].name[lang];
      btns.forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
      if (animate && hasGsap) gsap.from("#slideLabel, #slideNum", { yPercent: 110, opacity: 0, duration: 1, stagger: .06, ease: "expo.out" });
    }
    function play(i) {
      if (!hasGsap || reduced) return;
      if (auto) auto.kill();
      btns.forEach((b, k) => gsap.set($(".sn-fill", b), { scaleX: k < i ? 1 : 0 }));
      auto = gsap.fromTo($(".sn-fill", btns[i]), { scaleX: 0 }, { scaleX: 1, duration: 6.5, ease: "none", onComplete: () => goTo((i + 1) % SLIDES.length) });
      if (!visible) auto.pause();
    }
    function goTo(i) {
      if (busy || i === cur || !texs[i]) return;
      busy = true;
      next = i;
      uniforms.uTex2.value = texs[i];
      uniforms.uImg2.value.copy(sizes[i]);
      kenBurns(i);
      label(i, true);
      play(i);
      gsap.fromTo(uniforms.uProgress, { value: 0 }, {
        value: 1, duration: 2.1, ease: "power2.inOut",
        onComplete: () => {
          uniforms.uTex1.value = texs[i];
          uniforms.uImg1.value.copy(sizes[i]);
          cur = i;
          uniforms.uProgress.value = 0;
          busy = false;
        }
      });
    }
    btns.forEach((b, i) => b.addEventListener("click", () => goTo(i)));
    new IntersectionObserver(([en]) => { if (auto) en.isIntersecting ? auto.resume() : auto.pause(); }).observe(heroEl);
    label(0, false);

    return {
      uniforms, ready,
      start() { kenBurns(0); play(0); },
      relabel() { $("#slideLabel").textContent = SLIDES[cur].name[lang]; }
    };
  }

  /* =========================================================
     Préloader + intro + animations au scroll (GSAP)
     ========================================================= */
  const loader = $("#loader");
  const countEl = $("#loaderCount");
  document.body.classList.add("is-loading");

  function startSite() {
    document.body.classList.remove("is-loading");
    if (!hasGsap || reduced) {
      loader.remove();
      if (heroGL) heroGL.uniforms.uIntro.value = 1;
      return;
    }
    const tl = gsap.timeline();
    tl.to(".loader-inner", { opacity: 0, scale: .94, duration: .6, ease: "power2.in" })
      .to(loader, { clipPath: "inset(50% 0 50% 0)", duration: 1.3, ease: "expo.inOut" }, "-=.1")
      .add(() => loader.remove());
    if (heroGL) tl.to(heroGL.uniforms.uIntro, { value: 1, duration: 2.8, ease: "power2.inOut" }, "-=.7");
    tl.from(".ht-1 .ch", { yPercent: 105, duration: 1.8, stagger: .07, ease: "expo.out" }, "-=2.1")
      .from(".ht-2 .ch", { yPercent: 110, opacity: 0, rotate: 8, duration: 1.6, stagger: .045, ease: "expo.out" }, "-=1.5")
      .from(".hero-top > *, .hero-aside > *", { y: 30, opacity: 0, duration: 1.2, stagger: .1, ease: "expo.out" }, "-=1.3")
      .from(".hero-bar > *", { y: 20, opacity: 0, duration: 1, stagger: .1, ease: "expo.out" }, "-=1")
      .add(() => { if (heroGL) heroGL.start(); }, "-=.6");
  }

  if (reduced) { startSite(); }
  else {
    const minTime = 1900;
    const t0 = performance.now();
    const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
    const texReady = heroGL ? heroGL.ready : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 5000));
    let done = false, started = false;
    const go = () => { if (!started) { started = true; startSite(); } };
    (function tick() {
      if (started) return;
      const p = Math.min((performance.now() - t0) / minTime, done ? 1 : 0.96);
      countEl.textContent = String(Math.round(p * 100)).padStart(2, "0");
      if (p < 1) requestAnimationFrame(tick);
      else go();
    })();
    // onglet en arrière-plan : requestAnimationFrame peut être suspendu
    setTimeout(go, 6000);
    Promise.race([Promise.all([fontsReady, texReady]), timeout]).then(() => { done = true; });
  }

  if (hasGsap && window.ScrollTrigger && !reduced) {
    // le hero se referme en carte et les lettres s'envolent au scroll
    const heroST = { trigger: "#hero", start: "top top", end: "bottom top", scrub: true };
    ScrollTrigger.create({ ...heroST, onUpdate: (self) => { if (heroGL) heroGL.uniforms.uScroll.value = self.progress; } });
    gsap.fromTo("#heroMedia", { clipPath: "inset(0% 0% 0% 0% round 0px)" }, { clipPath: "inset(7% 4% 0% 4% round 28px)", ease: "none", scrollTrigger: heroST });
    gsap.to(".ht-1 .ch", { yPercent: (i) => -30 - i * 22, ease: "none", scrollTrigger: heroST });
    gsap.to(".ht-2", { xPercent: 12, ease: "none", scrollTrigger: heroST });
    gsap.to(".hero-top, .hero-aside, .hero-bar", { y: -80, opacity: 0, ease: "none", scrollTrigger: { ...heroST, end: "60% top" } });

    // titres et textes
    $$(".section .reveal-lines").forEach((el) => {
      gsap.from($$(".wi", el), { yPercent: 115, rotate: 4, duration: 1.4, stagger: .045, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });

    // rideau doré qui dévoile les images
    $$(".exp-img, .srv-visual, .member-img, .ba-frame").forEach((box) => {
      const c = document.createElement("div");
      c.className = "curtain";
      box.appendChild(c);
      gsap.set(c, { scaleY: 1, transformOrigin: "top" });
      const img = $("img", box);
      gsap.timeline({ scrollTrigger: { trigger: box, start: "top 82%" } })
        .to(c, { scaleY: 0, duration: 1.5, ease: "expo.inOut" })
        .from(img, { scale: 1.35, duration: 2.2, ease: "expo.out" }, .25);
    });

    // bande typographique géante
    gsap.fromTo(".bt-1", { xPercent: 0 }, { xPercent: -28, ease: "none", scrollTrigger: { trigger: ".bigtype", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".bt-2", { xPercent: -20 }, { xPercent: 8, ease: "none", scrollTrigger: { trigger: ".bigtype", start: "top bottom", end: "bottom top", scrub: true } });

    // inclinaison de la galerie selon la vitesse du scroll
    const skewTo = gsap.quickTo(".gal-item", "skewX", { duration: .7, ease: "power3" });
    if (lenis) lenis.on("scroll", (e) => skewTo(gsap.utils.clamp(-7, 7, e.velocity * -0.35)));
    $$(".section .reveal-up").forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });
    $$(".eyebrow").forEach((el) => {
      if (el.closest(".hero")) return;
      gsap.from(el, { x: -20, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } });
    });

    // parallaxe des images
    $$(".parallax").forEach((el) => {
      const sp = parseFloat(el.dataset.speed) || 0.1;
      gsap.fromTo(el, { yPercent: -sp * 100 }, { yPercent: sp * 100, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo($("img", el), { yPercent: -8 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // compteurs
    $$(".count").forEach((el) => {
      const to = +el.dataset.to, dec = +el.dataset.dec || 0;
      const o = { v: 0 };
      gsap.to(o, {
        v: to, duration: 2.2, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
        onUpdate: () => { el.textContent = formatCount(o.v, dec); },
        onComplete: () => { el.dataset.done = "1"; }
      });
    });

    // prestations
    gsap.from("#srvList .srv-item", { y: 30, opacity: 0, duration: 1, stagger: .07, ease: "expo.out", scrollTrigger: { trigger: ".srv-body", start: "top 80%" } });

    // galerie horizontale épinglée (desktop)
    const mm = gsap.matchMedia();
    mm.add("(min-width: 761px)", () => {
      const track = $("#galTrack");
      const dist = () => track.scrollWidth - innerWidth + 96;
      gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: { trigger: "#galerie", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
    });
    gsap.from(".gal-item", { y: 80, opacity: 0, duration: 1.4, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: "#galerie", start: "top 75%" } });

    // avant/après : petit balayage d'invitation
    const ba = { v: 50 };
    gsap.timeline({ scrollTrigger: { trigger: "#baFrame", start: "top 70%" } })
      .to(ba, { v: 78, duration: 1, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } })
      .to(ba, { v: 26, duration: 1.2, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } })
      .to(ba, { v: 50, duration: .9, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } });

    // équipe, anniversaire, infos
    gsap.from(".member", { y: 90, opacity: 0, rotateX: 10, duration: 1.6, stagger: .2, ease: "expo.out", scrollTrigger: { trigger: ".team-grid", start: "top 82%" } });
    gsap.from(".bday", { scale: .92, opacity: 0, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: ".bday", start: "top 85%" } });
    gsap.from(".bday-minus", { yPercent: 60, opacity: 0, duration: 1.6, delay: .2, ease: "expo.out", scrollTrigger: { trigger: ".bday", start: "top 85%" } });
    gsap.from(".info-card", { y: 60, opacity: 0, duration: 1.3, stagger: .12, ease: "expo.out", scrollTrigger: { trigger: ".info-grid", start: "top 85%" } });

    addEventListener("load", () => ScrollTrigger.refresh());
  }
})();
