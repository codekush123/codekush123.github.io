/* Kush Patel — site behaviour. Plain JavaScript, no dependencies.
   Everything here is an enhancement: the page reads fine without it. */
(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasIO = "IntersectionObserver" in window;

  /* ---------- theme ---------- */
  const THEME_KEY = "theme";
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const themeBtn = $("[data-theme-toggle]");
  const themeMetas = $$('meta[name="theme-color"]');
  const PAGE_BG = { light: "#faf9f7", dark: "#0d0d0c" };

  const storedTheme = () => {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  };
  const currentTheme = () => root.getAttribute("data-theme") || (darkQuery.matches ? "dark" : "light");

  function syncThemeUi() {
    const theme = currentTheme();
    const explicit = root.getAttribute("data-theme");
    if (themeBtn) themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    themeMetas.forEach((meta) => {
      const media = meta.getAttribute("media") || "";
      meta.setAttribute("content", PAGE_BG[explicit || (media.includes("dark") ? "dark" : "light")]);
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode: keep it for this visit */ }
      syncThemeUi();
    });
  }
  if (darkQuery.addEventListener) {
    darkQuery.addEventListener("change", () => {
      if (!storedTheme()) { root.removeAttribute("data-theme"); syncThemeUi(); }
    });
  }
  syncThemeUi();

  /* ---------- header ---------- */
  const header = $("[data-header]");
  let scrollQueued = false;
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
      scrollQueued = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const nav = $("[data-nav]");
  const menuBtn = $("[data-menu]");
  function setMenu(open) {
    if (!nav || !menuBtn) return;
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (nav && menuBtn) {
    menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("is-open") && !e.target.closest("[data-nav], [data-menu]")) setMenu(false);
    });
  }

  /* ---------- current section in the nav ---------- */
  const navLinks = $$("[data-nav] a[href^='#']");
  if (hasIO && navLinks.length) {
    const targets = navLinks
      .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
      .filter(Boolean);
    const hero = $("[data-hero]");
    if (hero) targets.unshift(hero);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const href = "#" + entry.target.id;
        navLinks.forEach((a) => {
          if (a.getAttribute("href") === href) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach((t) => spy.observe(t));
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = $$("[data-reveal]");
  if (hasIO && revealEls.length && !reduceMotion.matches) {
    root.classList.add("reveal-ready");
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); reveal.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    const limit = window.innerHeight * 0.94;
    revealEls.forEach((el) => {
      // Anything already on screen (or above it) shows at once, with no animation.
      if (el.getBoundingClientRect().top < limit) el.classList.add("is-in");
      else reveal.observe(el);
    });
  }

  /* ---------- local time in Helsinki ---------- */
  const clock = $("[data-clock]");
  if (clock && window.Intl && Intl.DateTimeFormat) {
    let fmt = null;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch (e) { fmt = null; }
    if (fmt) {
      const tick = () => { clock.textContent = " · " + fmt.format(new Date()) + " local time"; };
      tick();
      clock.hidden = false;
      setInterval(tick, 20000);
    }
  }

  /* ---------- hero: dots light up around the pointer ---------- */
  const hero = $("[data-hero]");
  if (hero && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion.matches) {
    let frame = 0, mx = 0, my = 0;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          hero.style.setProperty("--mx", mx + "px");
          hero.style.setProperty("--my", my + "px");
          frame = 0;
        });
      }
      hero.classList.add("is-lit");
    });
    hero.addEventListener("pointerleave", () => hero.classList.remove("is-lit"));
  }

  /* ---------- copy email ---------- */
  $$("[data-copy]").forEach((btn) => {
    const status = btn.parentElement ? $("[data-copy-status]", btn.parentElement) : null;
    let timer = 0;
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
        ta.remove();
      }
      if (status) status.textContent = ok ? "Email address copied" : "Couldn't copy. The address is " + text;
      if (ok) {
        btn.classList.add("is-copied");
        btn.setAttribute("aria-label", "Email address copied");
        clearTimeout(timer);
        timer = setTimeout(() => {
          btn.classList.remove("is-copied");
          btn.setAttribute("aria-label", "Copy email address");
        }, 2000);
      }
    });
  });

  /* ---------- drawing-reader walkthrough ---------- */
  const demo = $("[data-demo]");
  if (demo) initDemo(demo);

  function initDemo(demo) {
    const tablist = $('[role="tablist"]', demo);
    const tabs = $$('[role="tab"]', demo);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    const dwg = $(".dwg", demo);
    const playBtn = $("[data-demo-play]", demo);
    const playLabel = $("[data-play-label]", demo);
    const STEP_MS = 4200;
    const lastStep = tabs.length - 1;
    let step = 0;
    let playing = false;
    let elapsed = 0;
    let lastTime = 0;
    let raf = 0;
    let resumeWhenVisible = false;

    const rows = $$("tr[data-dim]", demo);
    const dims = new Map($$(".dim[data-dim]", dwg).map((g) => [g.getAttribute("data-dim"), g]));

    function clearHighlight() {
      dims.forEach((g) => g.classList.remove("is-hl"));
      rows.forEach((r) => r.classList.remove("is-hl"));
      dwg.classList.remove("has-hl");
    }
    function highlight(key) {
      clearHighlight();
      const g = dims.get(key);
      if (!g) return;
      g.classList.add("is-hl");
      dwg.classList.add("has-hl");
      rows.forEach((r) => r.classList.toggle("is-hl", r.getAttribute("data-dim") === key));
    }

    function setPlayUi() {
      demo.classList.toggle("is-playing", playing);
      const label = playing ? "Pause" : step === lastStep ? "Replay" : "Play";
      playLabel.textContent = label;
      playBtn.setAttribute("aria-label", label + " walkthrough");
    }

    function keepTabInView(tab) {
      const lr = tablist.getBoundingClientRect();
      const tr = tab.getBoundingClientRect();
      if (tr.left < lr.left || tr.right > lr.right) {
        tablist.scrollBy({ left: tr.left - lr.left - 12, behavior: reduceMotion.matches ? "auto" : "smooth" });
      }
    }

    function select(i, focus) {
      step = Math.max(0, Math.min(lastStep, i));
      tabs.forEach((t, j) => {
        const on = j === step;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle("is-done", j < step);
        if (on && playing) t.style.setProperty("--progress", "0");
        else t.style.removeProperty("--progress");
      });
      panels.forEach((p, j) => { p.hidden = j !== step; });
      dwg.setAttribute("data-step", String(step + 1));
      clearHighlight();
      keepTabInView(tabs[step]);
      if (focus) tabs[step].focus();
      setPlayUi();
    }

    function frame(now) {
      if (!playing) return;
      if (lastTime) elapsed += now - lastTime;
      lastTime = now;
      tabs[step].style.setProperty("--progress", Math.min(elapsed / STEP_MS, 1).toFixed(3));
      if (elapsed >= STEP_MS) {
        if (step < lastStep) {
          elapsed = 0;
          select(step + 1);
        } else {
          stop();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    function start(fromBeginning) {
      playing = true;
      lastTime = 0;
      if (fromBeginning) { elapsed = 0; select(0); }
      setPlayUi();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      tabs[step].style.removeProperty("--progress");
      elapsed = 0;
      setPlayUi();
    }
    function pause() {
      // Keeps the place within the step, for when the walkthrough scrolls out of view.
      playing = false;
      cancelAnimationFrame(raf);
      setPlayUi();
    }

    playBtn.addEventListener("click", () => {
      resumeWhenVisible = false;
      if (playing) stop();
      else start(step === lastStep);
    });
    $("[data-demo-prev]", demo).addEventListener("click", () => { stop(); select(step === 0 ? lastStep : step - 1); });
    $("[data-demo-next]", demo).addEventListener("click", () => { stop(); select(step === lastStep ? 0 : step + 1); });

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => { resumeWhenVisible = false; stop(); select(i); });
    });
    tablist.addEventListener("keydown", (e) => {
      let next = null;
      if (e.key === "ArrowRight") next = step === lastStep ? 0 : step + 1;
      else if (e.key === "ArrowLeft") next = step === 0 ? lastStep : step - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = lastStep;
      if (next === null) return;
      e.preventDefault();
      resumeWhenVisible = false;
      stop();
      select(next, true);
    });

    rows.forEach((row) => {
      const key = row.getAttribute("data-dim");
      row.addEventListener("pointerenter", () => highlight(key));
      row.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") clearHighlight(); });
      row.addEventListener("focus", () => highlight(key));
      row.addEventListener("blur", clearHighlight);
      row.addEventListener("click", () => highlight(key));
    });
    dims.forEach((g, key) => {
      g.addEventListener("pointerenter", () => { if (step === 3) highlight(key); });
      g.addEventListener("pointerleave", () => { if (step === 3) clearHighlight(); });
    });

    // Without JavaScript every panel shows; with it, one at a time.
    select(0);

    // Play once on its own the first time it comes into view; pause while off screen.
    if (hasIO && !reduceMotion.matches) {
      let autoplayed = false;
      const watcher = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio >= 0.45) {
            if (!autoplayed) { autoplayed = true; start(false); }
            else if (resumeWhenVisible) { resumeWhenVisible = false; start(false); }
          } else if (entry.intersectionRatio === 0 && playing) {
            resumeWhenVisible = true;
            pause();
          }
        });
      }, { threshold: [0, 0.45] });
      watcher.observe(demo);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing) { resumeWhenVisible = true; pause(); }
      else if (!document.hidden && resumeWhenVisible) {
        const r = demo.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) { resumeWhenVisible = false; start(false); }
      }
    });
  }

  /* ---------- corpus chart ---------- */
  const chart = $("[data-chart]");
  if (chart) initChart(chart);

  function initChart(chart) {
    const figure = chart.closest("figure") || document;
    const views = $$("[data-chart-view]", chart);
    const buttons = $$(".seg [data-view]", figure);
    const tip = $("[data-tip]", chart);
    const total = Number(chart.getAttribute("data-total")) || 1;
    const marks = $$("[data-n]", chart);

    function grow(view) {
      if (reduceMotion.matches) return;
      view.classList.add("is-entering");
      view.getBoundingClientRect(); // commit the collapsed state before animating
      requestAnimationFrame(() => requestAnimationFrame(() => view.classList.remove("is-entering")));
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-view");
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        views.forEach((view) => {
          const on = view.getAttribute("data-chart-view") === name;
          if (on && view.hidden) { view.hidden = false; grow(view); }
          else if (!on) view.hidden = true;
        });
        hideTip();
      });
    });

    // Bars grow in the first time the chart scrolls into view.
    if (hasIO && !reduceMotion.matches) {
      const first = views.find((v) => !v.hidden);
      if (first && first.getBoundingClientRect().top > window.innerHeight) {
        first.classList.add("is-entering");
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            setTimeout(() => first.classList.remove("is-entering"), 150);
          }
        }, { threshold: 0.3 });
        io.observe(first);
      }
    }

    function hideTip() { tip.classList.remove("is-on"); }
    function showTip(mark, e) {
      const n = Number(mark.getAttribute("data-n"));
      tip.textContent = "";
      const value = document.createElement("strong");
      value.textContent = n.toLocaleString("en-US") + " papers";
      const label = document.createElement("span");
      label.textContent = mark.getAttribute("data-label") + " · " + ((n / total) * 100).toFixed(1) + "% of the corpus";
      tip.append(value, label);
      placeTip(mark, e);
      tip.classList.add("is-on");
    }
    function placeTip(mark, e) {
      const box = chart.getBoundingClientRect();
      const isCol = mark.classList.contains("col");
      const anchor = $(isCol ? ".cval" : ".bar", mark) || mark;
      const ar = anchor.getBoundingClientRect();
      // Columns: centred over the column. Bars: at the pointer, or at the bar's end on focus.
      let x = isCol ? ar.left + ar.width / 2 : e ? e.clientX : ar.right;
      x -= box.left;
      const half = tip.offsetWidth / 2;
      x = Math.max(half, Math.min(box.width - half, x));
      tip.style.left = x + "px";
      tip.style.top = ar.top - box.top + "px";
    }

    marks.forEach((mark) => {
      mark.addEventListener("pointerenter", (e) => showTip(mark, e));
      mark.addEventListener("pointermove", (e) => { if (!mark.classList.contains("col")) placeTip(mark, e); });
      mark.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hideTip(); });
      mark.addEventListener("focus", () => showTip(mark));
      mark.addEventListener("blur", hideTip);
    });
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest("[data-n]")) hideTip(); });
  }
})();
