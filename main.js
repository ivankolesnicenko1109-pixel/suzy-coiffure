(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  // une seule courbe pour tout le site : cubic-bezier(0.22, 1, 0.36, 1)
  if (hasGsap) gsap.defaults({ ease: "power4.out" });

  let heroGL = null;
  let renderTryUI = null;
  let studioUI = null;

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
    if (heroGL && heroGL.relabel) heroGL.relabel();
    if (renderTryUI) renderTryUI();
    if (studioUI) studioUI();
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
  // prestations mises en avant (à valider avec le salon)
  const POPULAR = ["Butterfly Cut avec shampoing, sans séchage", "Shampoing & brushing wave", "Balayage Air Touch", "Coloration hydratante, coupe & brushing",
    "Soin botox / soin réparateur", "Coupe homme + shampoing / sourcils", "Pose vernis semi-permanent, par Valentina", "Coupe kids"];
  const fmtPrice = (p) => typeof p === "number" ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : p;
  const priceHtml = (price, from) => price === null
    ? `<b class="srv-free">${t("srv.free")}</b>`
    : `${from ? `<small>${t("srv.from")}</small> ` : ""}<b>${fmtPrice(price)}</b> CHF`;

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
    const isPop = (names) => POPULAR.includes(Array.isArray(names) ? names[0] : names);
    const shown = cat.items.slice().sort((a, b) => isPop(b[0]) - isPop(a[0])).slice(0, 6);
    list.innerHTML = shown.map(([names, price, from]) => `
      <li class="srv-item">
        <span class="srv-name">${Array.isArray(names) ? names[LANG_INDEX[lang]] : names}${isPop(names) ? `<em class="srv-pop">★ ${t("srv.popular")}</em>` : ""}</span>
        <span class="srv-dots" aria-hidden="true"></span>
        <span class="srv-price">${priceHtml(price, from)}</span>
      </li>`).join("");
    const img = $("#srvImg");
    if (!img.src.endsWith(cat.img)) img.src = cat.img;
    $("#srvLabel").textContent = cat.label[lang];
  }
  function animateServiceList() {
    if (!hasGsap || reduced) return;
    gsap.from("#srvList .srv-item", { y: 24, opacity: 0, duration: .8, stagger: .06, ease: "power4.out" });
    gsap.fromTo("#srvImg", { scale: 1.15, opacity: .4 }, { scale: 1, opacity: 1, duration: 1.2, ease: "power4.out" });
  }

  /* ---------- Avis ---------- */
  function renderReviews() {
    const card = ([text, who]) => `<article class="rev-card"><p>${text}</p><div class="rev-meta"><span class="stars">★★★★★</span><span>${who} · Salonkee</span></div></article>`;
    $("#revTrack").innerHTML = REVIEWS.map(card).join("");
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
      document.dispatchEvent(new CustomEvent("ba:pair", { detail: { before: BA_PAIRS[i].before, after: BA_PAIRS[i].after } }));
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
    const foot = $("#footHours");
    if (foot) foot.innerHTML = order.map((d) => `<li><span>${days[d]}</span><span>${HOURS[d] ? HOURS[d][0] + "–" + HOURS[d][1] : t("info.closed")}</span></li>`).join("");
    const h = HOURS[today];
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (s) => { const [a, b] = s.split(":").map(Number); return a * 60 + b; };
    const open = !!h && mins >= toMin(h[0]) && mins < toMin(h[1]);
    const st = $("#openStatus");
    st.className = "status " + (open ? "open" : "closed");
    if (open) {
      const left = toMin(h[1]) - mins;
      st.textContent = t("info.closesIn").replace("{t}", `${Math.floor(left / 60)}h${String(left % 60).padStart(2, "0")}`);
    } else {
      // prochaine ouverture : plus tard aujourd'hui, demain, ou tel jour
      let k = h && mins < toMin(h[0]) ? 0 : 1;
      while (k < 8 && !HOURS[(today + k) % 7]) k++;
      const d = (today + k) % 7;
      const when = k === 0 ? t("info.today") : k === 1 ? t("info.tomorrow") : (lang === "de" ? days[d] : days[d].toLowerCase());
      st.textContent = t("info.opensAt").replace("{d}", when).replace("{h}", HOURS[d][0]);
    }
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
    if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -70, duration: 1.6, onComplete: () => { if (window.ScrollTrigger) ScrollTrigger.update(); } });
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
    cur.insertAdjacentHTML("beforeend", `<span class="cursor-comb">${$(".hh-ico") ? $(".hh-ico").innerHTML : ""}</span>`);
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const hov = e.target.closest("a, button, input, .tilt");
      const hair = !lab && !hov && e.target.closest(".hero.has-gl, .foot-giant.has-gl");
      cur.classList.toggle("is-label", !!lab);
      label.textContent = lab ? lab.dataset.cursor : "";
      cur.classList.toggle("is-hover", !lab && !!hov);
      cur.classList.toggle("is-comb", !!hair);
    });

    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        // attirance de 10 px au plus, puis retour en ressort
        const k = Math.min(1, 10 / Math.max(Math.abs(x * 0.25), Math.abs(y * 0.35), 1));
        el.style.transform = `translate(${x * 0.25 * k}px, ${y * 0.35 * k}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
      el.style.transition = "transform .7s cubic-bezier(.34, 1.56, .64, 1), background .5s, box-shadow .5s, color .5s, border-color .5s";
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
    if (hasGsap) gsap.fromTo("#lbImg", { scale: .92, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, ease: "power4.out" });
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
     HERO — cheveux vivants (hair.js) + pastilles de teinte
     ========================================================= */
  const mobileGL = matchMedia("(max-width: 760px)").matches || !finePointer;
  heroGL = window.SuzyGL ? SuzyGL.hero({ canvas: $("#heroCanvas"), title: $(".ht-1"), reduced, mobile: mobileGL }) : null;
  const SHADE_KEYS = ["blond", "cuivre", "chatain", "balayage"];
  function renderShades() {
    const box = $("#hairDots");
    if (!box || !heroGL) return;
    box.innerHTML = SHADE_KEYS.map((k) => `<button type="button" class="hd" role="radio" aria-checked="${heroGL.shade === k}" data-k="${k}" style="--c:${heroGL.color(k)}"><i></i><span>${t("hair." + k)}</span></button>`).join("");
    $$(".hd", box).forEach((b) => b.addEventListener("click", () => {
      const r = b.getBoundingClientRect();
      heroGL.setShade(b.dataset.k, r.left + r.width / 2, r.top + r.height / 2);
      if (footGL) footGL.setShade(b.dataset.k);
      if (!tryChosen) {
        tryKey = { blond: "airtouch", cuivre: "cuivre", chatain: "gloss", balayage: "balayage" }[b.dataset.k];
        if (tryGL) tryGL.setMode(tryKey);
        renderTry();
      }
      renderShades();
    }));
  }
  if (heroGL) heroGL.relabel = renderShades;
  renderShades();

  /* =========================================================
     ESSAYEZ VOTRE COULEUR — mèche 3D (chargée à l'approche)
     ========================================================= */
  const TRY = [
    { k: "balayage", price: 100 },
    { k: "airtouch", price: 120 },
    { k: "gloss", price: 49 },
    { k: "cuivre", price: 79 }
  ];
  let tryKey = "balayage", tryGL = null, tryChosen = false, footGL = null;
  function renderTry() {
    const box = $("#trySwatches");
    if (!box) return;
    box.innerHTML = TRY.map(({ k }) => {
      const m = window.SuzyGL ? SuzyGL.MODES[k] : null;
      const bg = m ? `linear-gradient(160deg, ${m.root}, ${m.tip})` : "var(--gold)";
      return `<button type="button" class="try-sw" role="radio" aria-checked="${k === tryKey}" data-k="${k}"><i style="background:${bg}"></i><span>${t("try." + k)}</span></button>`;
    }).join("");
    $$(".try-sw", box).forEach((b) => b.addEventListener("click", () => {
      tryKey = b.dataset.k;
      tryChosen = true;
      if (tryGL) tryGL.setMode(tryKey);
      renderTry();
      if (hasGsap && !reduced) gsap.from(".try-card > *", { y: 14, opacity: 0, duration: .8, stagger: .05 });
    }));
    const cur = TRY.find((x) => x.k === tryKey);
    $("#tryName").textContent = t("try." + tryKey);
    $("#tryDesc").textContent = t("try." + tryKey + ".d");
    $("#tryPrice").innerHTML = `<b>${cur.price}</b> CHF`;
  }
  renderTry();
  renderTryUI = renderTry;
  const tryCanvas = $("#tryCanvas");
  if (tryCanvas && window.SuzyGL) {
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      tryGL = SuzyGL.lock({ canvas: tryCanvas, reduced, mobile: mobileGL });
      if (tryGL) { tryGL.setMode(tryKey); $("#essayez").classList.add("has-gl"); }
    }, { rootMargin: "400px" }).observe(tryCanvas);
  }

  /* ---------- Avant / après liquide (ordinateur seulement) ---------- */
  const baLiquid = !!window.SuzyGL && finePointer && !matchMedia("(max-width: 760px)").matches;
  if (baLiquid) {
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      SuzyGL.liquidBA({ frame: baFrame, range: baRange, reduced });
    }, { rootMargin: "500px" }).observe(baFrame);
  }

  /* =========================================================
     Préloader + intro + animations au scroll (GSAP)
     ========================================================= */
  // pas de préloader : le hero s'affiche tout de suite (image préchargée), le texte entre en douceur
  function startSite() {
    const root = document.documentElement;
    const box = $("#logoIntro");
    const playIntro = root.classList.contains("intro-on") && hasGsap && !reduced;
    // les cheveux ne disparaissent jamais : ils apparaissent une fois, en fondu, et continuent de vivre
    if (heroGL) heroGL.ready.then(() => heroGL.reveal());
    if (!playIntro) {
      if (box) box.remove();
      root.classList.remove("logos-hidden");
      try { sessionStorage.setItem("introSeen", "1"); } catch (e) { /* stockage indisponible */ }
      revealContent(root.classList.contains("intro-quick") ? .8 : 1);
      return;
    }
    if (lenis) lenis.stop();
    // onglet ouvert en arrière-plan : l'intro attend qu'on le regarde, sinon elle se jouerait sans témoin
    const whenVisible = () => document.hidden ? new Promise((r) => {
      const f = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", f); r(); } };
      document.addEventListener("visibilitychange", f);
    }) : Promise.resolve();
    whenVisible().then(() => runIntro(box)).then(() => {
      try { sessionStorage.setItem("introSeen", "1"); } catch (e) { /* stockage indisponible */ }
      revealContent(1);
    });
  }

  // le contenu du hero arrive en cascade : navigation, titre, sous-titre, boutons, indice
  function revealContent(dur) {
    const root = document.documentElement;
    const done = () => { if (lenis) lenis.start(); if (heroGL) setTimeout(() => heroGL.demo(), 900); };
    if (!hasGsap || reduced) { root.classList.remove("intro-on", "intro-quick"); done(); return; }
    const k = dur < 1 ? .65 : 1;
    const tl = gsap.timeline({ onComplete: done, defaults: { ease: "power3.out" } });
    tl.from(".nav-inner > *:not(.logo-pair)", { y: 24, opacity: 0, duration: dur, stagger: .12 * k })
      .from(".hero-top > *", { y: 24, opacity: 0, duration: dur, stagger: .12 * k }, `<+${.12 * k}`)
      .from(".ht-1 .ch", { yPercent: 105, duration: 1.4 * k, stagger: .06 * k, ease: "power4.out" }, `<+${.12 * k}`)
      .from(".ht-2 .ch", { yPercent: 110, opacity: 0, duration: 1.2 * k, stagger: .04 * k, ease: "power4.out" }, `<+${.12 * k}`)
      .from(".hero-line", { y: 24, opacity: 0, duration: dur }, `<+${.12 * k}`)
      .from(".hero-actions > *", { y: 24, opacity: 0, duration: dur, stagger: .12 * k }, `<+${.12 * k}`)
      .from(".hero-bar > *", { y: 24, opacity: 0, duration: dur, stagger: .12 * k }, `<+${.12 * k}`);
    // les styles « from » sont posés : on peut lever le masque CSS sans flash
    root.classList.remove("intro-on", "intro-quick");
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  // vestibule : les deux logos se dessinent ensemble sur les cheveux, puis s'envolent dans l'en-tête
  function runIntro(box) {
    return new Promise((resolve) => {
      const vids = $$("video", box);
      // HEVC à transparence pour Safari (macOS, iOS) ; WebM VP9 à transparence pour tous les autres.
      // Chrome sait lire le HEVC mais sans la transparence : il ne doit jamais le choisir.
      const ua = navigator.userAgent;
      const webkitOnly = /iP(hone|ad|od)/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua));
      vids.forEach((v) => {
        const src = document.createElement("source");
        src.src = webkitOnly ? v.dataset.hevc : v.dataset.webm;
        src.type = webkitOnly ? 'video/mp4; codecs="hvc1"' : "video/webm";
        v.appendChild(src);
        v.load();
      });
      // les vidéos durent 10 s : jouées 2,3 fois plus vite, tout le vestibule tient en 4 à 5 s
      const T0 = 500, SHINE = 8.7, RATE = 2.3;
      let exited = false, playing = false, resolved = false;
      const finish = () => { if (!resolved) { resolved = true; resolve(); } };
      box.classList.add("is-active");

      const loaded = (v) => new Promise((res, rej) => {
        if (v.readyState >= 4) return res();
        v.addEventListener("canplaythrough", res, { once: true });
        const last = $$("source", v).pop();
        if (last) last.addEventListener("error", rej, { once: true });
        v.addEventListener("error", rej, { once: true });
      });
      // au bout de 4 s on tente quand même la lecture : sur iPhone, la vidéo ne se charge souvent qu'au premier play()
      const ready = Promise.race([
        Promise.all(vids.map(loaded)),
        new Promise((res) => setTimeout(res, 4000))
      ]);
      ready.catch(() => { /* traité plus bas : on passe aux PNG */ });

      // la vidéo doit vraiment être transparente : un coin opaque veut dire que le navigateur a perdu l'alpha
      function alphaOk(v) {
        try {
          const c = document.createElement("canvas");
          c.width = 32; c.height = 32;
          const x = c.getContext("2d", { willReadFrequently: true });
          x.drawImage(v, 0, 0, 32, 32);
          return x.getImageData(1, 1, 1, 1).data[3] < 128;
        } catch (e) { return true; }
      }

      function showPng() {
        box.classList.add("is-png");
        gsap.fromTo($$(".li-png", box), { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 1.5, ease: "power2.out" });
      }
      function fallback() {
        if (exited) return;
        showPng();
        setTimeout(exit, 1400);
      }
      function exit() {
        if (exited) return;
        exited = true;
        box.classList.add("is-on");
        if (!playing && !box.classList.contains("is-png")) { box.classList.add("is-png"); gsap.set($$(".li-png", box), { opacity: 1 }); }
        const tl = gsap.timeline({
          onComplete: () => {
            document.documentElement.classList.remove("logos-hidden");
            // on libère la mémoire des vidéos
            vids.forEach((v) => { v.pause(); $$("source", v).forEach((s) => s.remove()); v.removeAttribute("src"); v.load(); });
            box.remove();
            finish();
          }
        });
        [[".li-suzy", ".lp-suzy"], [".li-val", ".lp-val"]].forEach(([from, to]) => {
          const a = $(from, box);
          const ra = a.getBoundingClientRect(), rb = $(to).getBoundingClientRect();
          gsap.set(a, { transformOrigin: "0 0" });
          tl.to(a, { x: rb.left - ra.left, y: rb.top - ra.top, scale: rb.width / ra.width, duration: .9, ease: "power3.inOut" }, 0);
        });
        tl.to($(".li-line", box), { opacity: 0, duration: .45 }, 0)
          .to($(".li-veil", box), { opacity: 0, duration: 1 }, 0)
          .to($(".li-skip", box), { opacity: 0, duration: .3 }, 0)
          // le contenu commence à arriver une demi-seconde après le départ des logos
          .call(finish, null, .4);
      }
      $("#introSkip").addEventListener("click", exit);

      setTimeout(() => {
        if (exited) return;
        box.classList.add("is-on");
        ready.then(() => {
          if (exited) return;
          // départ des deux vidéos dans la même image
          requestAnimationFrame(() => {
            vids.forEach((v) => { v.currentTime = 0; v.defaultPlaybackRate = RATE; v.playbackRate = RATE; });
            Promise.all(vids.map((v) => v.play())).then(() => {
              playing = true;
              // contrôles : transparence présente, et lecture qui avance vraiment
              setTimeout(() => {
                if (exited) return;
                if (!vids.every(alphaOk)) { vids.forEach((v) => v.pause()); playing = false; fallback(); }
              }, 500);
              setTimeout(() => {
                if (exited || !playing) return;
                if (vids.some((v) => v.currentTime < 0.3)) { vids.forEach((v) => v.pause()); playing = false; fallback(); }
              }, 3000);
              const watch = () => {
                if (exited) return;
                if (vids[0].currentTime >= SHINE || vids[0].ended) exit();
                else requestAnimationFrame(watch);
              };
              watch();
              setTimeout(exit, (SHINE / RATE + 1.5) * 1000);
            }, fallback);
          });
        }, fallback);
      }, T0);
    });
  }
  startSite();

  if (hasGsap && window.ScrollTrigger && !reduced) {
    // le hero se referme en carte et les lettres s'envolent au scroll
    const heroST = { trigger: "#hero", start: "top top", end: "bottom top", scrub: true };
    ScrollTrigger.create({ ...heroST, onUpdate: (self) => { if (heroGL) heroGL.setScroll(self.progress); } });
    gsap.fromTo("#heroMedia", { clipPath: "inset(0% 0% 0% 0% round 0px)" }, { clipPath: "inset(7% 4% 0% 4% round 28px)", ease: "none", scrollTrigger: heroST });
    gsap.fromTo(".ht-1 .ch", { yPercent: 0 }, { yPercent: (i) => -30 - i * 22, ease: "none", immediateRender: false, scrollTrigger: heroST });
    gsap.to(".ht-2", { xPercent: 12, ease: "none", scrollTrigger: heroST });
    gsap.fromTo(".hero-top, .hero-aside, .hero-bar", { y: 0, opacity: 1 }, { y: -80, opacity: 0, ease: "none", immediateRender: false, scrollTrigger: { ...heroST, end: "60% top" } });

    // titres et textes
    $$(".section .reveal-lines").forEach((el) => {
      gsap.from($$(".wi", el), { yPercent: 115, rotate: 4, duration: 1.4, stagger: .045, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });

    // rideau doré qui dévoile les images
    $$(".exp-img, .srv-visual, .ba-frame").forEach((box) => {
      const c = document.createElement("div");
      c.className = "curtain";
      box.appendChild(c);
      gsap.set(c, { scaleY: 1, transformOrigin: "top" });
      const img = $("img", box);
      gsap.timeline({ scrollTrigger: { trigger: box, start: "top 82%" } })
        .to(c, { scaleY: 0, duration: 1.5, ease: "power4.inOut" })
        .from(box.classList.contains("member-logo") ? [] : img, { scale: 1.35, duration: 2.2, ease: "power4.out" }, .25);
    });

    $$(".section .reveal-up").forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });
    $$(".eyebrow").forEach((el) => {
      if (el.closest(".hero")) return;
      gsap.from(el, { x: -20, opacity: 0, duration: 1, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 92%" } });
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
    gsap.from("#srvList .srv-item", { y: 30, opacity: 0, duration: 1, stagger: .07, ease: "power4.out", scrollTrigger: { trigger: ".srv-body", start: "top 80%" } });

    gsap.from(".gal-item", { y: 40, opacity: 0, duration: 1.1, stagger: .06, ease: "power4.out", scrollTrigger: { trigger: ".gal-grid", start: "top 85%" } });

    // avant/après : petit balayage d'invitation
    const ba = { v: 50 };
    if (!baLiquid) gsap.timeline({ scrollTrigger: { trigger: "#baFrame", start: "top 70%" } })
      .to(ba, { v: 78, duration: 1, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } })
      .to(ba, { v: 26, duration: 1.2, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } })
      .to(ba, { v: 50, duration: .9, ease: "power2.inOut", onUpdate: () => { baFrame.style.setProperty("--pos", ba.v + "%"); baRange.value = ba.v; } });

    // équipe, anniversaire, infos
    gsap.from(".member", { y: 90, opacity: 0, rotateX: 10, duration: 1.6, stagger: .2, ease: "power4.out", scrollTrigger: { trigger: ".team-grid", start: "top 82%" } });
    gsap.from(".bday", { scale: .92, opacity: 0, duration: 1.6, ease: "power4.out", scrollTrigger: { trigger: ".bday", start: "top 85%" } });
    gsap.from(".info-card", { y: 60, opacity: 0, duration: 1.3, stagger: .12, ease: "power4.out", scrollTrigger: { trigger: ".info-grid", start: "top 85%" } });

    addEventListener("load", () => ScrollTrigger.refresh());
  }

  /* =========================================================
     Détails « studio » : index des sections, fil d'or, lecture,
     citation, « SUZY » en cheveux, titre d'onglet
     ========================================================= */
  const pad2 = (n) => String(n).padStart(2, "0");
  const SECS = ["experience", "services", "essayez", "galerie", "avant-apres", "equipe", "avis", "contact"].map((id) => $("#" + id)).filter(Boolean);
  const secIndex = $("#secIndex");
  function renderIndex() {
    SECS.forEach((sec, i) => {
      const eb = $(".eyebrow", sec);
      if (!eb) return;
      let num = $(".sec-num", eb);
      if (!num) { num = document.createElement("span"); num.className = "sec-num"; eb.prepend(num); }
      num.textContent = pad2(i + 1) + " — ";
    });
    secIndex.innerHTML = SECS.map((sec, i) => {
      const eb = $(".eyebrow", sec);
      const name = eb ? t(eb.dataset.i18n) : "";
      return `<a href="#${sec.id}"><span>${pad2(i + 1)}</span><em>${name}</em></a>`;
    }).join("");
    $$("a", secIndex).forEach((a, i) => a.addEventListener("click", (e) => {
      e.preventDefault();
      if (lenis) lenis.scrollTo(SECS[i], { offset: -80 }); else SECS[i].scrollIntoView({ behavior: "smooth" });
    }));
  }
  function markIndex() {
    const y = innerHeight * 0.45;
    let cur = -1;
    SECS.forEach((sec, i) => { if (sec.getBoundingClientRect().top < y) cur = i; });
    $$("a", secIndex).forEach((a, i) => a.classList.toggle("is-active", i === cur));
    secIndex.classList.toggle("is-on", cur >= 0 && $("#contact").getBoundingClientRect().bottom > 0);
  }
  addEventListener("scroll", markIndex, { passive: true });

  // lecture : les mots du texte « L'expérience » foncent un à un au fil du défilement
  let readTween = null;
  function readReveal() {
    const el = $(".read-reveal");
    if (!el || !hasGsap || !window.ScrollTrigger || reduced) return;
    el.innerHTML = el.textContent.split(/(\s+)/).map((w) => /^\s+$/.test(w) ? w : `<span class="rw">${w}</span>`).join("");
    if (readTween) { readTween.scrollTrigger.kill(); readTween.kill(); }
    readTween = gsap.fromTo($$(".rw", el), { opacity: .18 }, { opacity: 1, stagger: .1, ease: "none", scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 42%", scrub: .4 } });
  }

  // avis : une grande citation, qui change toute seule toutes les 6 secondes
  let qi = 0, qTimer = null;
  function showQuote(i, animate) {
    qi = (i + REVIEWS.length) % REVIEWS.length;
    const [text, who] = REVIEWS[qi];
    const put = () => {
      $("#qText").innerHTML = text.split(/(\s+)/).map((w) => /^\s+$/.test(w) ? w : `<span class="qw">${w}</span>`).join("");
      $("#qWho").textContent = who + " · Salonkee";
      $("#qCount").textContent = `${pad2(qi + 1)} / ${pad2(REVIEWS.length)}`;
      if (animate && hasGsap && !reduced) gsap.from("#qText .qw", { opacity: 0, y: 10, filter: "blur(6px)", duration: .9, stagger: .012 });
    };
    if (animate && hasGsap && !reduced && $("#qText .qw")) {
      gsap.to("#qText .qw", { opacity: 0, y: -8, filter: "blur(6px)", duration: .45, stagger: .006, ease: "power2.in", onComplete: put });
    } else put();
  }
  function autoQuote() {
    clearInterval(qTimer);
    if (!reduced) qTimer = setInterval(() => showQuote(qi + 1, true), 6000);
  }
  if ($("#quote")) {
    $("#qPrev").addEventListener("click", () => { showQuote(qi - 1, true); autoQuote(); });
    $("#qNext").addEventListener("click", () => { showQuote(qi + 1, true); autoQuote(); });
    $("#quote").addEventListener("mouseenter", () => clearInterval(qTimer));
    $("#quote").addEventListener("mouseleave", autoQuote);
    autoQuote();
  }

  // fil d'or : une mèche qui part du hero, coud les sections entre elles et finit dans le « SUZY » du pied de page
  const thread = $("#goldThread"), tpath = $("#goldPath");
  let tLen = 0, tTable = [], tShown = 0;
  function buildThread() {
    if (!thread) return;
    const W = document.documentElement.clientWidth;
    const abs = (el) => el.getBoundingClientRect().top + scrollY;
    const giant = $(".foot-giant");
    const end = abs(giant) + giant.offsetHeight * 0.55;
    const L = W < 760 ? 7 : Math.max(18, W * 0.028), R = W - L;
    let x = W * 0.06, y = abs($("#hero")) + $("#hero").offsetHeight * 0.9;
    let d = `M ${x} ${y}`;
    SECS.forEach((sec, i) => {
      const top = abs(sec), h = sec.offsetHeight;
      const nx = i % 2 ? L : R;
      // la mèche traverse la page à la couture entre deux sections, en S
      d += ` C ${x} ${top + 10}, ${nx} ${top - 10}, ${nx} ${top + 90}`;
      x = nx; y = top + 90;
      // puis elle descend le long de la marge en ondulant doucement
      const amp = (i % 2 ? 1 : -1) * Math.min(L * 0.8, 22);
      const y2 = top + h - 60;
      if (y2 > y + 100) { d += ` C ${x + amp} ${y + (y2 - y) * 0.33}, ${x - amp} ${y + (y2 - y) * 0.66}, ${x} ${y2}`; y = y2; }
    });
    // arrivée : une boucle qui se pose au centre du mot géant
    const cx = W * 0.5;
    d += ` C ${x} ${end - 120}, ${cx - W * 0.2} ${end - 160}, ${cx} ${end - 40} S ${cx + W * 0.08} ${end + 40}, ${cx} ${end}`;
    thread.setAttribute("viewBox", `0 0 ${W} ${end + 60}`);
    thread.style.height = end + 60 + "px";
    tpath.setAttribute("d", d);
    tLen = tpath.getTotalLength();
    tTable = [];
    for (let k = 0; k <= 400; k++) { const l = (tLen * k) / 400; tTable.push([l, tpath.getPointAtLength(l).y]); }
    tpath.style.strokeDasharray = tLen;
    drawThread(true);
  }
  function drawThread(jump) {
    if (!tLen) return;
    const target = scrollY + innerHeight * 0.62;
    let l = 0;
    for (const [len, py] of tTable) { if (py <= target) l = Math.max(l, len); }
    if (reduced) l = tLen;
    tShown = jump ? l : tShown + (l - tShown) * 0.12;
    tpath.style.strokeDashoffset = tLen - tShown;
  }
  (function threadLoop() { drawThread(false); requestAnimationFrame(threadLoop); })();
  let tRes = null;
  const rebuild = () => { clearTimeout(tRes); tRes = setTimeout(buildThread, 200); };
  addEventListener("resize", rebuild);
  addEventListener("load", rebuild);
  if (window.ScrollTrigger) ScrollTrigger.addEventListener("refresh", rebuild);

  // « SUZY » géant du pied de page, rempli des mêmes cheveux que le hero
  const footCanvas = $("#footHair");
  if (footCanvas && window.SuzyGL) {
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      footGL = SuzyGL.hero({ canvas: footCanvas, maskEl: $(".fg-word"), reduced, mobile: mobileGL });
      if (footGL && heroGL && heroGL.shade !== "blond") footGL.setShade(heroGL.shade);
    }, { rootMargin: "300px" }).observe(footCanvas);
  }

  // onglet inactif : le salon vous attend
  const baseTitle = document.title;
  document.addEventListener("visibilitychange", () => { document.title = document.hidden ? t("tab.away") : baseTitle; });

  studioUI = () => { renderIndex(); readReveal(); showQuote(qi, false); markIndex(); };
  studioUI();
  rebuild();
})();
