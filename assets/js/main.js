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
     2. PRELOADER
     --------------------------------------------------------------------- */
  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloaderBar");

  window.addEventListener("load", () => {
    gsap.to(preloaderBar, { width: "100%", duration: 0.6, ease: "power2.out", delay: 0.15 });
    gsap.to(preloader, {
      opacity: 0,
      duration: 0.7,
      delay: 0.55,
      ease: "power2.inOut",
      onComplete: () => {
        preloader.style.display = "none";
        document.body.classList.add("is-ready");
        runHeroIntro();
        ScrollTrigger.refresh();
      },
    });
  });

  // Safety net in case 'load' stalls (slow video fetch etc.)
  setTimeout(() => {
    if (preloader && preloader.style.display !== "none") {
      window.dispatchEvent(new Event("load"));
    }
  }, 3500);

  /* ---------------------------------------------------------------------
     3. CUSTOM CURSOR (desktop only)
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
     4. NAV — solid on scroll + mobile menu
     --------------------------------------------------------------------- */
  const nav = document.getElementById("siteNav");
  ScrollTrigger.create({
    start: 80,
    end: 99999,
    onUpdate: (self) => nav.classList.toggle("is-solid", self.scroll() > 80),
  });

  const burgerBtn = document.getElementById("burgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  function closeMobileMenu() {
    document.body.classList.remove("nav-open");
  }
  if (burgerBtn) {
    burgerBtn.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
  }
  mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobileMenu));

  /* ---------------------------------------------------------------------
     5. HERO INTRO (runs once preloader clears)
     --------------------------------------------------------------------- */
  function runHeroIntro() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.set([".hero__kicker", ".hero__sub", ".hero__ctas"], { opacity: 0, y: 18 })
      .set("[data-hero-word]", { yPercent: 120 })
      .to("[data-hero-word]", { yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.05)
      .to(".hero__kicker", { opacity: 1, y: 0, duration: 0.8 }, 0.15)
      .to(".hero__sub", { opacity: 1, y: 0, duration: 0.8 }, 0.55)
      .to(".hero__ctas", { opacity: 1, y: 0, duration: 0.8 }, 0.68);
  }
  if (reduceMotion) {
    // ensure content is visible immediately
    gsap.set("[data-hero-word]", { yPercent: 0 });
    gsap.set([".hero__kicker", ".hero__sub", ".hero__ctas"], { opacity: 1, y: 0 });
  }

  /* ---------------------------------------------------------------------
     6. GENERIC SCROLL REVEALS  [data-reveal]
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
     7. MANIFESTO — line-by-line mask reveal
     --------------------------------------------------------------------- */
  document.querySelectorAll(".manifesto__text .h2 .mask-line > span").forEach((span, i) => {
    gsap.fromTo(
      span,
      { yPercent: 115 },
      {
        yPercent: 0, duration: 0.9, ease: "power3.out", delay: i * 0.045,
        scrollTrigger: { trigger: span, start: "top 92%", once: true },
      }
    );
  });

  /* ---------------------------------------------------------------------
     8. ILLUSION GALLERY — curtain wipe reveal (signature moment)
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
     9. COOKIES — slow Ken Burns on scroll
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
     10. VIENNOISERIE — pinned scroll-scrubbed video + captions
     --------------------------------------------------------------------- */
  const scrubVideo = document.getElementById("scrubVideo");
  const vienSection = document.querySelector(".viennoiserie");
  const caps = gsap.utils.toArray(".viennoiserie__cap");
  const dots = gsap.utils.toArray(".viennoiserie__progress b");

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
  gsap.set(caps, { y: 14 });
  setCaption(0);

  if (scrubVideo && vienSection) {
    let ready = false;
    const initScrub = () => {
      if (ready) return;
      ready = true;
      ScrollTrigger.create({
        trigger: vienSection,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
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
  }

  /* ---------------------------------------------------------------------
     11. PATISSERIE — sticky crossfade tied to text scroll
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
     12. ATELIER — parallax background
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
     13. MENU — iframe loading state
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
     14. HERO subtle parallax on media
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
     15. Story cards — staggered reveal
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
     16. Resize housekeeping
     --------------------------------------------------------------------- */
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => ScrollTrigger.refresh(), 250);
  });
})();
