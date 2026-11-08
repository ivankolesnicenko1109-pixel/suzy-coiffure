(() => {
  "use strict";

  /* Pages intérieures : réservation, réalisations, tarifs.
     La page d'accueil garde son propre script (main.js). */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- i18n ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
  };
  let lang = store.get("suzy-lang");
  if (!I18N[lang]) lang = "fr";
  const t = (k) => (I18N[lang][k] ?? I18N.fr[k] ?? "");
  const LOCALE = { fr: "fr-CH", en: "en-GB", de: "de-CH" };
  const renderers = [];

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

  function applyLang(next) {
    lang = next;
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$(".reveal-lines").forEach(splitWords);
    $$(".lang button").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === lang));
    renderers.forEach((fn) => fn());
    store.set("suzy-lang", lang);
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  const fmtPrice = (p) => typeof p === "number" ? (Number.isInteger(p) ? String(p) : p.toFixed(2)) : p;
  const priceHtml = (price, from) => price === null
    ? `<b class="srv-free">${t("srv.free")}</b>`
    : `${from ? `<small>${t("srv.from")}</small>` : ""}<b>${fmtPrice(price)}</b> CHF`;
  const priceText = (price, from) => price === null ? t("srv.free") : `${from ? t("srv.from") + " " : ""}${fmtPrice(price)} CHF`;

  /* ---------- navigation ---------- */
  const nav = $("#nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > 500 && y > lastY && !$("#mobileMenu").classList.contains("is-open"));
    lastY = y;
  }, { passive: true });
  const burger = $("#burger"), menu = $("#mobileMenu");
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    nav.classList.add("is-scrolled");
  });
  $("#year").textContent = new Date().getFullYear();

  /* ---------- curseur + boutons magnétiques ---------- */
  if (finePointer && !reduced) {
    const cur = $("#cursor"), label = $("#cursorLabel");
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });
    (function loop() {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const hov = e.target.closest("a, button, input, select, textarea, label");
      cur.classList.toggle("is-label", !!lab);
      label.textContent = lab ? lab.dataset.cursor : "";
      cur.classList.toggle("is-hover", !lab && !!hov);
    });
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* =========================================================
     RÉSERVATION
     ========================================================= */
  function initBooking() {
    const root = $("#booking");
    if (!root) return;

    // Les créneaux libres en temps réel sont sur Salonkee : ici on prépare le choix
    const SALONKEE = "https://salonkee.ch/salon/suzy-coiffure?lang=";
    const params = new URLSearchParams(location.search);
    const startCat = SERVICES.find((c) => c.id === params.get("cat")) ? params.get("cat") : SERVICES[0].id;
    const state = {
      cat: startCat,
      svc: params.has("s") && params.get("cat") ? { cat: startCat, i: +params.get("s") } : null,
      who: "any"
    };
    if (state.svc && !SERVICES.find((c) => c.id === state.svc.cat).items[state.svc.i]) state.svc = null;
    const svcItem = () => state.svc && SERVICES.find((c) => c.id === state.svc.cat).items[state.svc.i];
    const stylistName = (w) => w === "suzy" ? "Suzy" : w === "valentina" ? "Valentina" : t("book.any");

    function renderServices() {
      $("#bkTabs").innerHTML = SERVICES.map((c) => `<button type="button" class="srv-tab" data-cat="${c.id}" aria-selected="${c.id === state.cat}">${c.label[lang]}</button>`).join("");
      const cat = SERVICES.find((c) => c.id === state.cat);
      $("#bkServices").innerHTML = cat.items.map(([name, price, from], i) => {
        const on = state.svc && state.svc.cat === cat.id && state.svc.i === i;
        return `<button type="button" class="bk-svc" data-i="${i}" aria-pressed="${!!on}"><span class="bk-svc-name">${name}</span><span class="bk-svc-price">${priceHtml(price, from)}</span></button>`;
      }).join("");
      $$("#bkTabs .srv-tab").forEach((b) => b.addEventListener("click", () => { state.cat = b.dataset.cat; renderServices(); }));
      $$("#bkServices .bk-svc").forEach((b) => b.addEventListener("click", () => {
        state.svc = { cat: state.cat, i: +b.dataset.i };
        renderServices(); renderSummary();
      }));
    }
    function renderStylists() {
      const list = [
        ["any", t("book.any"), t("book.anyHint"), null],
        ["suzy", "Suzy", t("book.suzyHint"), "assets/logo/suzy-original.jpg"],
        ["valentina", "Valentina", t("book.valHint"), "assets/logo/valentina-original.jpg"]
      ];
      $("#bkStylists").innerHTML = list.map(([id, name, hint, img]) => `
        <button type="button" class="bk-who" data-who="${id}" aria-pressed="${state.who === id}">
          <span class="bk-who-img">${img ? `<img src="${img}" alt="">` : `<span class="bk-who-any">✦</span>`}</span>
          <span class="bk-who-name">${name}</span><span class="bk-who-hint">${hint}</span>
        </button>`).join("");
      $$("#bkStylists .bk-who").forEach((b) => b.addEventListener("click", () => {
        state.who = b.dataset.who;
        renderStylists(); renderWeek(); renderSummary();
      }));
    }

    // Semaine type : horaires du salon ; le lundi, présence de chaque coiffeuse (source : page Salonkee)
    const AXIS = [9, 19];
    const toH = (s) => { const [a, b] = s.split(":").map(Number); return a + b / 60; };
    const MONDAY = { suzy: [["15:00", "18:30"]], valentina: [["09:30", "12:00"], ["15:00", "18:30"]] };
    function renderWeek() {
      const days = t("days");
      const pos = (a, b) => `left:${(toH(a) - AXIS[0]) / (AXIS[1] - AXIS[0]) * 100}%;width:${(toH(b) - toH(a)) / (AXIS[1] - AXIS[0]) * 100}%`;
      const bar = (cls, a, b, label) => `<span class="wk-bar ${cls}" style="${pos(a, b)}"><span>${label || a + " – " + b}</span></span>`;
      const today = new Date().getDay();
      let html = `<div class="wk-axis">${[9, 11, 13, 15, 17, 19].map((h) => `<span style="left:${(h - AXIS[0]) / (AXIS[1] - AXIS[0]) * 100}%">${h}h</span>`).join("")}</div>`;
      [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
        const h = HOURS[d];
        let lanes = "";
        if (!h) lanes = `<div class="wk-lane"><span class="wk-closed">${t("info.closed")}</span></div>`;
        else if (d === 1) {
          ["suzy", "valentina"].filter((w) => state.who === "any" || state.who === w).forEach((w) => {
            lanes += `<div class="wk-lane" data-who="${w}">${MONDAY[w].map(([a, b]) => bar(w === "suzy" ? "is-suzy" : "is-val", a, b)).join("")}</div>`;
          });
        } else lanes = `<div class="wk-lane">${bar("is-salon", h[0], h[1])}</div>`;
        html += `<div class="wk-row ${d === today ? "is-today" : ""} ${h ? "" : "is-closed"}"><span class="wk-day">${days[d]}</span><div class="wk-lanes">${lanes}</div></div>`;
      });
      $("#bkWeek").innerHTML = html;
    }
    function renderSummary() {
      const it = svcItem();
      const row = (k, v, ok) => `<div class="bk-sum-row"><span>${k}</span><b class="${ok ? "" : "is-empty"}">${v}</b></div>`;
      $("#bkSummary").innerHTML =
        row(t("book.s1"), it ? it[0] : t("book.pick"), !!it) +
        row(t("book.s2"), stylistName(state.who), true) +
        `<div class="bk-sum-total"><span>${t("book.price")}</span><b>${it ? priceText(it[1], it[2]) : "—"}</b></div>`;
      const how2 = it ? t("book.how2svc").replace("{svc}", `<strong>${it[0]}</strong>`) : t("book.how2");
      const how = state.who === "any" ? how2 : how2 + " " + t("book.how2who").replace("{who}", `<strong>${stylistName(state.who)}</strong>`);
      $("#bkHow2").innerHTML = `<span>${how}</span>`;
      $$("#bkGo, #bkGo2").forEach((a) => { a.href = SALONKEE + lang; });
    }
    function renderAll() { renderServices(); renderStylists(); renderWeek(); renderSummary(); }
    renderers.push(renderAll);
  }

  /* =========================================================
     RÉALISATIONS
     ========================================================= */
  function initWorks() {
    const grid = $("#worksGrid");
    if (!grid) return;
    const FILTERS = ["all", "blond", "waves", "copper", "bob", "updo"];
    const label = { all: "works.all", blond: "works.blond", waves: "works.waves", copper: "works.copper", bob: "works.bob", updo: "works.updo" };
    let filter = "all";
    const visible = () => PORTFOLIO.filter(([, tags]) => filter === "all" || tags.split(" ").includes(filter));

    function renderFilters() {
      $("#worksFilters").innerHTML = FILTERS.map((f) => {
        const n = f === "all" ? PORTFOLIO.length : PORTFOLIO.filter(([, tags]) => tags.split(" ").includes(f)).length;
        return `<button type="button" class="srv-tab" data-f="${f}" aria-selected="${f === filter}">${t(label[f])} <small>${n}</small></button>`;
      }).join("");
      $$("#worksFilters .srv-tab").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; renderFilters(); renderGrid(true); }));
    }
    function renderGrid(animate) {
      const list = visible();
      grid.innerHTML = list.map(([id, tags], k) => `
        <button type="button" class="work" data-k="${k}" data-cursor="Voir">
          <img src="assets/img/portfolio/p-${id}.jpg" alt="${t(label[tags.split(" ")[0]])}" loading="lazy">
          <span class="work-tag">${t(label[tags.split(" ")[0]])}</span>
        </button>`).join("");
      $("#worksCount").textContent = list.length + " " + t("works.count");
      $$(".work", grid).forEach((b) => b.addEventListener("click", () => openLb(+b.dataset.k)));
      if (animate && hasGsap && !reduced) gsap.from(".work", { y: 40, opacity: 0, duration: .9, stagger: .025, ease: "expo.out" });
    }

    // visionneuse
    const lb = $("#lightbox");
    let cur = 0;
    function showLb() {
      const list = visible(), [id, tags] = list[cur];
      $("#lbImg").src = `assets/img/portfolio/p-${id}.jpg`;
      $("#lbImg").alt = t(label[tags.split(" ")[0]]);
      $("#lbCap").textContent = `${t(label[tags.split(" ")[0]])} · ${cur + 1} / ${list.length}`;
    }
    function openLb(k) { cur = k; showLb(); lb.hidden = false; if (hasGsap) gsap.fromTo("#lbImg", { scale: .94, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: "expo.out" }); }
    const step = (d) => { const n = visible().length; cur = (cur + d + n) % n; showLb(); };
    $("#lbClose").addEventListener("click", () => { lb.hidden = true; });
    $("#lbPrev").addEventListener("click", () => step(-1));
    $("#lbNext").addEventListener("click", () => step(1));
    lb.addEventListener("click", (e) => { if (e.target === lb) lb.hidden = true; });
    addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") lb.hidden = true;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });

    // avant / après
    function renderPairs() {
      $("#worksPairs").innerHTML = BA_PAIRS.map((p, i) => `
        <figure class="pair">
          <div class="ba-frame pair-frame" style="--pos:50%">
            <img class="ba-after" src="${p.after}" alt="${p.label[lang]}" loading="lazy">
            <div class="ba-before-wrap"><img class="ba-before" src="${p.before}" alt="" loading="lazy"></div>
            <span class="ba-tag ba-tag-l">${t("ba.before")}</span><span class="ba-tag ba-tag-r">${t("ba.after")}</span>
            <div class="ba-handle" aria-hidden="true"><span>⟷</span></div>
            <label class="sr-only" for="pair${i}">${p.label[lang]}</label>
            <input type="range" id="pair${i}" min="0" max="100" value="50">
          </div>
          <figcaption>${p.label[lang]}</figcaption>
        </figure>`).join("");
      $$(".pair-frame").forEach((f) => { const r = $("input", f); r.addEventListener("input", () => f.style.setProperty("--pos", r.value + "%")); });
    }
    renderers.push(() => { renderFilters(); renderGrid(false); renderPairs(); });
  }

  /* =========================================================
     TARIFS
     ========================================================= */
  function initPrices() {
    const box = $("#priceList");
    if (!box) return;
    function render() {
      $("#priceNav").innerHTML = SERVICES.map((c) => `<a class="srv-tab" href="#cat-${c.id}">${c.label[lang]}</a>`).join("");
      box.innerHTML = SERVICES.map((c) => `
        <section class="price-cat" id="cat-${c.id}">
          <figure class="price-cat-img"><img src="${c.img}" alt="" loading="lazy"><figcaption>${c.label[lang]}</figcaption></figure>
          <div class="price-cat-body">
            <div class="price-cat-head"><h2>${c.label[lang]}</h2><a class="btn btn-ghost-dark btn-sm" href="reservation.html?cat=${c.id}">${t("prices.book")}</a></div>
            <ul class="srv-list">${c.items.map(([name, price, from], i) => `
              <li><a class="srv-item" href="reservation.html?cat=${c.id}&s=${i}">
                <span class="srv-name">${name}</span><span class="srv-dots" aria-hidden="true"></span>
                <span class="srv-price">${priceHtml(price, from)}</span></a></li>`).join("")}
            </ul>
          </div>
        </section>`).join("");
    }
    renderers.push(render);
  }

  initBooking();
  initWorks();
  initPrices();
  applyLang(lang);

  /* ---------- animations d'entrée ---------- */
  if (hasGsap && !reduced) {
    gsap.from(".page-hero .wi", { yPercent: 115, rotate: 4, duration: 1.4, stagger: .05, ease: "expo.out", delay: .1 });
    gsap.from(".page-hero .reveal-up", { y: 30, opacity: 0, duration: 1.2, stagger: .1, ease: "expo.out", delay: .3 });
    gsap.from(".page-hero-bg", { scale: 1.15, duration: 2.4, ease: "expo.out" });
    if (window.ScrollTrigger) {
      $$(".section .reveal-up").forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } }));
      $$(".price-cat").forEach((el) => gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } }));
    }
  }
})();
