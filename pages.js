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
    : `${from ? `<small>${t("srv.from")}</small> ` : ""}<b>${fmtPrice(price)}</b> CHF`;
  const priceText = (price, from) => price === null ? t("srv.free") : `${from ? t("srv.from") + " " : ""}${fmtPrice(price)} CHF`;

  /* ---------- navigation ---------- */
  const nav = $("#nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
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
          <img src="assets/img/portfolio/p-${id}.webp" alt="${t(label[tags.split(" ")[0]])}" loading="lazy">
          <span class="work-tag">${t(label[tags.split(" ")[0]])}</span>
        </button>`).join("");
      $("#worksCount").textContent = list.length + " " + t("works.count");
      $$(".work", grid).forEach((b) => b.addEventListener("click", () => openLb(+b.dataset.k)));
      if (animate && hasGsap && !reduced) gsap.from(".work", { y: 40, opacity: 0, duration: .9, stagger: .025, ease: "power4.out" });
    }

    // visionneuse
    const lb = $("#lightbox");
    let cur = 0;
    function showLb() {
      const list = visible(), [id, tags] = list[cur];
      $("#lbImg").src = `assets/img/portfolio/p-${id}.webp`;
      $("#lbImg").alt = t(label[tags.split(" ")[0]]);
      $("#lbCap").textContent = `${t(label[tags.split(" ")[0]])} · ${cur + 1} / ${list.length}`;
    }
    function openLb(k) { cur = k; showLb(); lb.hidden = false; if (hasGsap) gsap.fromTo("#lbImg", { scale: .94, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: "power4.out" }); }
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
            <div class="price-cat-head"><h2>${c.label[lang]}</h2><a class="btn btn-ghost-dark btn-sm" href="https://salonkee.ch/salon/suzy-coiffure?lang=fr" target="_blank" rel="noopener">${t("prices.book")}</a></div>
            <ul class="srv-list">${c.items.map(([name, price, from], i) => `
              <li><a class="srv-item" href="https://salonkee.ch/salon/suzy-coiffure?lang=fr" target="_blank" rel="noopener">
                <span class="srv-name">${Array.isArray(name) ? name[{ fr: 0, en: 1, de: 2 }[lang]] : name}</span><span class="srv-dots" aria-hidden="true"></span>
                <span class="srv-price">${priceHtml(price, from)}</span></a></li>`).join("")}
            </ul>
          </div>
        </section>`).join("");
    }
    renderers.push(render);

    // aperçu : une petite photo de la catégorie suit la souris sur la ligne survolée
    if (!finePointer || reduced) return;
    const pv = document.createElement("div");
    pv.className = "price-preview";
    pv.setAttribute("aria-hidden", "true");
    pv.innerHTML = "<img alt=\"\">";
    document.body.appendChild(pv);
    let px = 0, py = 0, x = 0, y = 0, on = false;
    box.addEventListener("mousemove", (e) => {
      px = e.clientX; py = e.clientY;
      const row = e.target.closest(".srv-item");
      const cat = row && row.closest(".price-cat");
      if (row && cat) {
        const src = $(".price-cat-img img", cat).getAttribute("src");
        if ($("img", pv).getAttribute("src") !== src) $("img", pv).setAttribute("src", src);
      }
      if (!!row !== on) { on = !!row; pv.classList.toggle("is-on", on); }
    });
    box.addEventListener("mouseleave", () => { on = false; pv.classList.remove("is-on"); });
    (function follow() {
      x += (px - x) * 0.14; y += (py - y) * 0.14;
      pv.style.transform = `translate(${x + 28}px, ${y - 130}px) rotate(${(px - x) * 0.04}deg)`;
      requestAnimationFrame(follow);
    })();
  }

  initWorks();
  initPrices();
  applyLang(lang);

  /* ---------- animations d'entrée ---------- */
  if (hasGsap && !reduced) {
    gsap.from(".page-hero .wi", { yPercent: 115, rotate: 4, duration: 1.4, stagger: .05, ease: "power4.out", delay: .1 });
    gsap.from(".page-hero .reveal-up", { y: 30, opacity: 0, duration: 1.2, stagger: .1, ease: "power4.out", delay: .3 });
    gsap.from(".page-hero-bg", { scale: 1.15, duration: 2.4, ease: "power4.out" });
    if (window.ScrollTrigger) {
      $$(".section .reveal-up").forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%" } }));
      $$(".price-cat").forEach((el) => gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 85%" } }));
    }
  }
})();
