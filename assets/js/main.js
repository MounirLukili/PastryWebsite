/* ==========================================================================
   EL FALEH PASTRY — main.js
   Lenis smooth scroll + GSAP/ScrollTrigger choreography.
   Motion is intentionally rationed: one clear device per section.
   ========================================================================== */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------------
     1. LENIS SMOOTH SCROLL
     --------------------------------------------------------------------- */
  let lenis;
  if (!reduceMotion) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false, // keep native touch feel on mobile
      touchMultiplier: 1.1,
    });

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    window.lenis = lenis;
  }

  // Anchor links -> lenis scrollTo (falls back to native if reduced motion)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMobileMenu();
      if (lenis) lenis.scrollTo(target, { offset: -8, duration: 1.3 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------------------------------------------------------------------
     2. VIDEO ELEMENTS + AUTOPLAY SAFETY (set up early, before preload gate)
     --------------------------------------------------------------------- */
  const heroVideo = document.getElementById("heroVideo");
  const scrubVideo = document.getElementById("scrubVideo");

  function ensureAutoplay(video) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => armRetry());
    };
    function armRetry() {
      const retry = () => { video.play().catch(() => {}); cleanup(); };
      const cleanup = () => {
        window.removeEventListener("touchstart", retry);
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("scroll", retry);
      };
      window.addEventListener("touchstart", retry, { once: true, passive: true });
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("scroll", retry, { once: true, passive: true });
    }
    tryPlay();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && video.paused) tryPlay();
    });
  }
  // Start the hero loop buffering/playing immediately — by the time the
  // preloader clears, it should already be rolling smoothly.
  ensureAutoplay(heroVideo);

  // The scrub video must never autoplay-loop (scroll controls it), but its
  // very first frame needs to be painted, or it shows a blank/black box
  // until the user starts scrolling. A play-then-immediately-pause nudge
  // forces the browser to render frame 0.
  function primeFirstFrame(video) {
    if (!video) return;
    const nudge = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.then(() => video.pause()).catch(() => { try { video.currentTime = 0.001; } catch (e) {} });
      } else {
        video.pause();
      }
    };
    if (video.readyState >= 2) nudge();
    else video.addEventListener("loadeddata", nudge, { once: true });
  }
  primeFirstFrame(scrubVideo);

  /* ---------------------------------------------------------------------
     3. PRELOADER — waits for real assets (images, both videos, webfonts)
        so the page never reveals ahead of what it needs to show.
     --------------------------------------------------------------------- */
  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloaderBar");
  const preloaderPct = document.getElementById("preloaderPct");

  function updateProgress(loaded, total) {
    const pct = total ? Math.round((loaded / total) * 100) : 100;
    if (preloaderBar) preloaderBar.style.width = pct + "%";
    if (preloaderPct) preloaderPct.textContent = pct + "%";
  }

  function loadAllAssets() {
    let loaded = 0;
    const tasks = [];

    // Only what's visible immediately needs to be ready before the page
    // shows: the small logo marks and the hero video. Everything else
    // (gallery images, the Viennoiserie video, etc.) keeps loading in the
    // background — it has plenty of time before the user scrolls that far,
    // and blocking on it just makes the loading screen drag on for nothing.
    document.querySelectorAll(".hero__mark, .nav__mark, .mobile-menu__logo img, .footer__logo-lockup img").forEach((img) => {
      if (img.complete && img.naturalWidth > 0) { tasks.push(Promise.resolve()); return; }
      tasks.push(new Promise((res) => {
        img.addEventListener("load", res, { once: true });
        img.addEventListener("error", res, { once: true });
      }));
    });

    // Hero video: wait only until it has a first frame ready (loadeddata),
    // not until it's buffered start-to-finish (canplaythrough) — much
    // faster, and it keeps buffering normally once playing.
    if (heroVideo) {
      if (heroVideo.readyState >= 2) {
        tasks.push(Promise.resolve());
      } else {
        tasks.push(new Promise((res) => {
          heroVideo.addEventListener("loadeddata", res, { once: true });
          heroVideo.addEventListener("error", res, { once: true });
        }));
      }
    }

    if (document.fonts && document.fonts.ready) {
      tasks.push(document.fonts.ready.catch(() => {}));
    }

    const total = tasks.length;
    updateProgress(0, total);

    return Promise.all(
      tasks.map((p) =>
        p.then(
          () => { loaded++; updateProgress(loaded, total); },
          () => { loaded++; updateProgress(loaded, total); }
        )
      )
    );
  }

  function revealSite() {
    if (document.body.classList.contains("is-ready")) return;
    gsap.to(preloader, {
      opacity: 0,
      duration: 0.7,
      ease: "power2.inOut",
      onComplete: () => {
        preloader.style.display = "none";
        document.body.classList.add("is-ready");
        runHeroIntro();
        ScrollTrigger.refresh();
      },
    });
  }

  // Race real loading against a generous ceiling — long enough that a slow
  // connection still gets to finish loading for real (which is the point),
  // short enough that a single stuck asset can't hang the page forever.
  const loadPromise = loadAllAssets();
  const timeoutPromise = new Promise((res) => setTimeout(res, 8000));
  Promise.race([loadPromise, timeoutPromise]).then(() => {
    updateProgress(1, 1);
    setTimeout(revealSite, 220);
  });

  /* ---------------------------------------------------------------------
     4. CUSTOM CURSOR (desktop only)
     --------------------------------------------------------------------- */
  const cursorDot = document.getElementById("cursorDot");
  if (!isTouch && cursorDot) {
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const mouse = { x: pos.x, y: pos.y };
    window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    gsap.ticker.add(() => {
      pos.x += (mouse.x - pos.x) * 0.18;
      pos.y += (mouse.y - pos.y) * 0.18;
      cursorDot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%)`;
    });
    document.querySelectorAll("a, button, .illusion-card, .story-card").forEach((el) => {
      el.addEventListener("mouseenter", () => cursorDot.classList.add("is-active"));
      el.addEventListener("mouseleave", () => cursorDot.classList.remove("is-active"));
    });
  } else if (cursorDot) {
    cursorDot.remove();
  }

  /* ---------------------------------------------------------------------
     5. NAV — solid on scroll + mobile menu
     --------------------------------------------------------------------- */
  const nav = document.getElementById("siteNav");
  ScrollTrigger.create({
    start: 80,
    end: 99999,
    onUpdate: (self) => nav.classList.toggle("is-solid", self.scroll() > 80),
  });

  const burgerBtn = document.getElementById("burgerBtn");
  const mobileCloseBtn = document.getElementById("mobileCloseBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  function closeMobileMenu() {
    document.body.classList.remove("nav-open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", "false");
  }
  function toggleMobileMenu() {
    const open = document.body.classList.toggle("nav-open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", String(open));
  }
  if (burgerBtn) burgerBtn.addEventListener("click", toggleMobileMenu);
  if (mobileCloseBtn) mobileCloseBtn.addEventListener("click", closeMobileMenu);
  mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobileMenu));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMobileMenu(); });

  /* ---------------------------------------------------------------------
     6. HERO INTRO (runs once preloader clears)
     --------------------------------------------------------------------- */
  function runHeroIntro() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.set([".hero__mark", ".hero__kicker", ".hero__sub", ".hero__ctas"], { opacity: 0, y: 18 })
      .set("[data-hero-word]", { yPercent: 120 })
      .to(".hero__mark", { opacity: 0.92, y: 0, duration: 0.8 }, 0)
      .to("[data-hero-word]", { yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.1)
      .to(".hero__kicker", { opacity: 1, y: 0, duration: 0.8 }, 0.2)
      .to(".hero__sub", { opacity: 1, y: 0, duration: 0.8 }, 0.58)
      .to(".hero__ctas", { opacity: 1, y: 0, duration: 0.8 }, 0.7);
  }
  if (reduceMotion) {
    // ensure content is visible immediately
    gsap.set("[data-hero-word]", { yPercent: 0 });
    gsap.set(".hero__mark", { opacity: 0.92, y: 0 });
    gsap.set([".hero__kicker", ".hero__sub", ".hero__ctas"], { opacity: 1, y: 0 });
  }

  /* ---------------------------------------------------------------------
     7. GENERIC SCROLL REVEALS  [data-reveal]
     --------------------------------------------------------------------- */
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
  });

  /* ---------------------------------------------------------------------
     8. MANIFESTO — responsive word-by-word reveal
        (splits at runtime so it adapts to any line-wrap width, instead of
        relying on hand-authored line breaks that only fit one viewport)
     --------------------------------------------------------------------- */
  function splitIntoWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = "";
    words.forEach((word, i) => {
      const outer = document.createElement("span");
      outer.className = "rw";
      const inner = document.createElement("span");
      inner.textContent = word;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return Array.from(el.querySelectorAll(".rw > span"));
  }

  document.querySelectorAll("[data-split-words]").forEach((el) => {
    const words = splitIntoWords(el);
    if (reduceMotion) return; // leave text in its final, readable state
    gsap.set(words, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 0.85, ease: "power3.out", stagger: 0.014 }),
    });
  });

  /* ---------------------------------------------------------------------
     9. ILLUSION GALLERY — curtain wipe reveal (signature moment)
     --------------------------------------------------------------------- */
  gsap.utils.toArray("[data-illusion]").forEach((card, i) => {
    const curtain = card.querySelector(".illusion-card__curtain");
    const reveal = card.querySelector(".illusion-card__reveal");
    const img = card.querySelector(".illusion-card__reveal img");
    const meta = card.querySelector(".illusion-card__meta");

    gsap.set(meta, { opacity: 0, y: 24 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: card, start: "top 82%", once: true },
      defaults: { ease: "power4.inOut" },
    });
    tl.to(curtain, { scaleY: 0, duration: 0.95, delay: i * 0.08 })
      .fromTo(reveal, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.95 }, "<")
      .fromTo(img, { scale: 1.32 }, { scale: 1.14, duration: 1.3, ease: "power2.out" }, "<")
      .to(meta, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "-=0.4");

    // subtle hover parallax on the image (desktop)
    if (!isTouch) {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(img, { x: px * 14, y: py * 14, duration: 0.6, ease: "power2.out" });
      });
      card.addEventListener("mouseleave", () => gsap.to(img, { x: 0, y: 0, duration: 0.8, ease: "power3.out" }));
    }
  });

  /* ---------------------------------------------------------------------
     10. COOKIES — slow Ken Burns on scroll
     --------------------------------------------------------------------- */
  const cookiesMain = document.querySelector(".cookies__main img");
  if (cookiesMain) {
    gsap.fromTo(
      cookiesMain,
      { scale: 1.18 },
      {
        scale: 1,
        ease: "none",
        scrollTrigger: { trigger: ".cookies", start: "top bottom", end: "bottom top", scrub: 0.6 },
      }
    );
  }
  const cookiesFloat = document.querySelector(".cookies__float");
  if (cookiesFloat) {
    gsap.fromTo(
      cookiesFloat,
      { y: 60 },
      { y: -30, ease: "none", scrollTrigger: { trigger: ".cookies", start: "top bottom", end: "bottom top", scrub: 0.6 } }
    );
  }

  /* ---------------------------------------------------------------------
     11. VIENNOISERIE — pinned scroll-scrubbed video + captions (desktop)
         On mobile, scroll-scrubbing a <video> via currentTime is unreliable
         across browsers (seek repaints get dropped, buffering stalls stop
         it rendering at all) — so on small/touch screens the video just
         plays normally instead, like the hero video, and captions are
         shown as plain stacked text (see the matching CSS override).
     --------------------------------------------------------------------- */
  const vienSection = document.querySelector(".viennoiserie");
  const caps = gsap.utils.toArray(".viennoiserie__cap");
  const dots = gsap.utils.toArray(".viennoiserie__progress b");
  const vienUseScrub = !isTouch && window.matchMedia("(min-width: 769px)").matches;

  function setCaption(progress) {
    const seg = Math.min(caps.length - 1, Math.floor(progress * caps.length));
    caps.forEach((c, i) => {
      gsap.to(c, { opacity: i === seg ? 1 : 0, y: i === seg ? 0 : 14, duration: 0.5, overwrite: "auto" });
    });
    dots.forEach((d, i) => {
      const local = gsap.utils.clamp(0, 1, progress * caps.length - i);
      gsap.set(d, { scaleX: local });
    });
  }

  if (scrubVideo && vienSection) {
    if (vienUseScrub) {
      gsap.set(caps, { y: 14 });
      setCaption(0);
      let ready = false;
      const initScrub = () => {
        if (ready) return;
        ready = true;
        ScrollTrigger.create({
          trigger: vienSection,
          start: "top top",
          end: "bottom bottom",
          scrub: true, // direct 1:1 with scroll position — Lenis already smooths the scroll itself, so adding scrub-smoothing on top just made the video lag behind where you'd actually scrolled
          onUpdate: (self) => {
            const dur = scrubVideo.duration || 0;
            if (dur) {
              try { scrubVideo.currentTime = self.progress * dur; } catch (e) {}
            }
            setCaption(self.progress);
          },
        });
      };
      if (scrubVideo.readyState >= 1) initScrub();
      else scrubVideo.addEventListener("loadedmetadata", initScrub);
      // Safety: if metadata never fires (autoplay policies), still allow caption cycling
      setTimeout(initScrub, 2000);
    } else {
      // Mobile/touch fallback: just play the video normally.
      scrubVideo.loop = true;
      ensureAutoplay(scrubVideo);
      gsap.set(caps, { opacity: 1, y: 0 });
      gsap.set(dots, { scaleX: 1 });
    }
  }

  /* ---------------------------------------------------------------------
     12. PATISSERIE — sticky crossfade tied to text scroll
     --------------------------------------------------------------------- */
  const patImgs = gsap.utils.toArray(".pat__visual img");
  document.querySelectorAll("[data-pat-trigger]").forEach((item) => {
    const idx = item.getAttribute("data-pat-trigger");
    ScrollTrigger.create({
      trigger: item,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => {
        if (self.isActive) {
          patImgs.forEach((img) => img.classList.toggle("is-active", img.dataset.pat === idx));
        }
      },
    });
  });

  /* ---------------------------------------------------------------------
     13. ATELIER — parallax background
     --------------------------------------------------------------------- */
  const atelierImg = document.querySelector("#atelierBg img");
  if (atelierImg) {
    gsap.fromTo(
      atelierImg,
      { scale: 1.22, yPercent: -6 },
      { scale: 1.05, yPercent: 6, ease: "none", scrollTrigger: { trigger: ".atelier", start: "top bottom", end: "bottom top", scrub: 0.6 } }
    );
  }

  /* ---------------------------------------------------------------------
     14. MENU — iframe loading state
     --------------------------------------------------------------------- */
  const menuIframe = document.getElementById("menuIframe");
  const menuLoading = document.getElementById("menuLoading");
  if (menuIframe && menuLoading) {
    menuIframe.addEventListener("load", () => {
      gsap.to(menuLoading, { opacity: 0, duration: 0.5, onComplete: () => (menuLoading.style.display = "none") });
    });
    setTimeout(() => { if (menuLoading) menuLoading.style.display = "none"; }, 6000);
  }

  /* ---------------------------------------------------------------------
     15. HERO subtle parallax on media
     --------------------------------------------------------------------- */
  const heroMedia = document.getElementById("heroMedia");
  if (heroMedia) {
    gsap.to(heroMedia, {
      yPercent: 12,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 },
    });
  }

  /* ---------------------------------------------------------------------
     16. Story cards — staggered reveal
     --------------------------------------------------------------------- */
  gsap.utils.toArray(".story-card").forEach((card, i) => {
    gsap.fromTo(
      card,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0, duration: 0.9, delay: i * 0.08, ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 90%", once: true },
      }
    );
  });

  /* ---------------------------------------------------------------------
     17. Resize housekeeping
     --------------------------------------------------------------------- */
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => ScrollTrigger.refresh(), 250);
  });
})();