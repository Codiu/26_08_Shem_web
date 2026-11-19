// Pearl Theme Dynamic Canvas Background & Interactive Effects
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let glowingOrbs = [];
  let mouse = { x: null, y: null, radius: 150 };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Floating Small Particles
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 3 + 1.5;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.baseAlpha = Math.random() * 0.5 + 0.3;
      this.alpha = this.baseAlpha;
      this.color = Math.random() > 0.4 ? '129, 140, 248' : '56, 189, 248'; // Indigo / Cyan
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse interaction
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 2;
          this.y -= (dy / dist) * force * 2;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
      ctx.fill();
    }
  }

  // Cache pre-rendered orbs for massive performance boost on low-end GPUs
  const orbCache = {};
  const orbColors = ['56, 189, 248', '99, 102, 241', '192, 132, 252', '245, 158, 11'];
  
  function getPreRenderedOrb(color, radius) {
    const key = `${color}-${Math.round(radius)}`;
    if (orbCache[key]) return orbCache[key];
    
    const offCanvas = document.createElement('canvas');
    const size = radius * 2;
    offCanvas.width = size;
    offCanvas.height = size;
    const octx = offCanvas.getContext('2d');
    
    const grad = octx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, `rgba(${color}, 1)`); // Max alpha, we scale alpha on drawImage
    grad.addColorStop(0.5, `rgba(${color}, 0.4)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    
    octx.beginPath();
    octx.arc(radius, radius, radius, 0, Math.PI * 2);
    octx.fillStyle = grad;
    octx.fill();
    
    orbCache[key] = offCanvas;
    return offCanvas;
  }

  // Large Soft Glowing Orbs
  class GlowingOrb {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 60 + 30; // 30px to 90px
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.alpha = Math.random() * 0.15 + 0.08;
      this.color = orbColors[Math.floor(Math.random() * orbColors.length)];
      this.img = getPreRenderedOrb(this.color, this.radius);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < -this.radius || this.x > width + this.radius) this.vx *= -1;
      if (this.y < -this.radius || this.y > height + this.radius) this.vy *= -1;
    }

    draw() {
      ctx.globalAlpha = this.alpha;
      ctx.drawImage(this.img, this.x - this.radius, this.y - this.radius);
      ctx.globalAlpha = 1.0; // Reset
    }
  }

  // Initialize elements
  // Drastically reduce particle count for low-end GPUs, keeping the aesthetic
  const particleCount = Math.min(Math.floor(window.innerWidth / 40), 30);
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  const orbCount = Math.min(Math.floor(window.innerWidth / 200), 8);
  for (let i = 0; i < orbCount; i++) {
    glowingOrbs.push(new GlowingOrb());
  }

  function drawConnections() {
    const maxDist = 120;
    const maxDistSq = maxDist * maxDist; // Use squared distance for performance
    
    ctx.lineWidth = 0.8;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDist) * 0.25;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
          ctx.stroke();
        }
      }
    }
  }

  // Use a variable to track if we should animate to save CPU when off-screen
  let isScrolling = false;
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    isScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => { isScrolling = false; }, 100);
  }, { passive: true });

  // 30 FPS Frame Limiter (saves GPU, battery, and ensures smooth scrolling)
  const TARGET_FPS = 30;
  const fpsInterval = 1000 / TARGET_FPS;
  let lastFrameTime = 0;

  function animate(currentTime) {
    requestAnimationFrame(animate);

    // Only render if browser window is visible and not heavily scrolling
    if (document.hidden || isScrolling) return;

    // Throttle to 30 FPS
    const elapsed = currentTime - lastFrameTime;
    if (elapsed < fpsInterval) return;
    lastFrameTime = currentTime - (elapsed % fpsInterval);

    ctx.clearRect(0, 0, width, height);

    glowingOrbs.forEach(orb => {
      orb.update();
      orb.draw();
    });

    drawConnections();

    particles.forEach(p => {
      p.update();
      p.draw();
    });
  }

  requestAnimationFrame(animate);

  // Mobile Menu Drawer Toggle
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileDrawer.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!mobileDrawer.contains(e.target) && !menuToggle.contains(e.target)) {
        mobileDrawer.classList.remove('active');
        menuToggle.classList.remove('active');
      }
    });
  }

  // Dynamic Transform-Origin for Author Photo Frame (Exact Quick View expansion formula)
  document.querySelectorAll('.author-photo-frame').forEach(frame => {
    frame.addEventListener('mouseenter', () => {
      const rect = frame.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const originY = (centerY / window.innerHeight) * 100;
      frame.style.transformOrigin = `50% ${originY}%`;
    });
  });

  // Deterministic "Quote of the Day" Calendar Picker with Seeded Cycle Shuffle
  const quoteText = document.getElementById('quoteText');
  const quoteTopic = document.getElementById('quoteTopic');
  const quoteAuthor = document.getElementById('quoteAuthor');

  let rawQuotes = window.SHEMSHUK_QUOTES;
  let quotesList = [];
  if (rawQuotes) {
    if (Array.isArray(rawQuotes.quotes)) {
      quotesList = rawQuotes.quotes;
    } else if (Array.isArray(rawQuotes)) {
      quotesList = rawQuotes;
    }
  }

  if (quoteText && quotesList.length > 0) {
    const N = quotesList.length;
    
    // Calculate current day index (days since Jan 1 1970 UTC)
    const now = new Date();
    const epochDays = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    
    const cycle = Math.floor(epochDays / N);
    const dayInCycle = Math.abs(epochDays % N);

    // Seeded pseudo-random generator based on cycle number
    let seed = Math.abs((cycle + 1) * 9301 + 49297);
    function seededRandom() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    // Generate deterministic shuffled permutation of [0..N-1] for this cycle
    const cycleOrder = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      const temp = cycleOrder[i];
      cycleOrder[i] = cycleOrder[j];
      cycleOrder[j] = temp;
    }

    const quoteIndex = cycleOrder[dayInCycle];
    const selectedQuote = quotesList[quoteIndex];

    if (selectedQuote) {
      quoteText.textContent = selectedQuote.quote || selectedQuote.text || '';
      if (quoteTopic) {
        quoteTopic.textContent = selectedQuote.overview || 'МЫСЛЬ ДНЯ';
      }
      if (quoteAuthor) {
        quoteAuthor.textContent = selectedQuote.author ? ('— ' + selectedQuote.author) : '— В. А. Шемшук';
      }

      // Плавное проявление темы и текста цитаты (рамка и автор уже видны)
      quoteText.style.transition = 'opacity 0.8s ease';
      if (quoteTopic) quoteTopic.style.transition = 'opacity 0.6s ease 0.15s';

      // Небольшой таймаут чтобы браузер успел применить transition до смены opacity
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          quoteText.style.opacity = '1';
          if (quoteTopic) quoteTopic.style.opacity = '1';
        });
      });
    }
  }

  // Automatic Infinite Scroll for Blog (Dual Trigger: Scroll + IntersectionObserver)
  const blogCards = Array.from(document.querySelectorAll('.blog-feed-grid .blog-card'));
  if (blogCards.length > 0) {
    const BATCH_SIZE = 9;
    let visibleCount = BATCH_SIZE;
    let isLoadingBlog = false;

    function loadNextBlogBatch() {
      if (isLoadingBlog || visibleCount >= blogCards.length) return;
      isLoadingBlog = true;

      const nextLimit = visibleCount + BATCH_SIZE;
      for (let i = visibleCount; i < nextLimit && i < blogCards.length; i++) {
        if (blogCards[i]) {
          blogCards[i].style.display = '';
        }
      }
      visibleCount = nextLimit;

      const blogSentinel = document.getElementById('blog-sentinel');
      if (visibleCount >= blogCards.length && blogSentinel) {
        blogSentinel.style.display = 'none';
      }

      setTimeout(() => { isLoadingBlog = false; }, 200);
    }

    function checkBlogScroll() {
      if (visibleCount >= blogCards.length) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const bodyHeight = document.documentElement.scrollHeight;
      if (bodyHeight - scrollPosition < 400) {
        loadNextBlogBatch();
      }
    }

    window.addEventListener('scroll', checkBlogScroll, { passive: true });
    window.addEventListener('resize', checkBlogScroll, { passive: true });

    const blogSentinel = document.getElementById('blog-sentinel');
    if (blogSentinel && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadNextBlogBatch();
        }
      }, { rootMargin: '300px' });
      observer.observe(blogSentinel);
    }
  }

  // Mobile Quick Nav - Hint Mode (Double Tap with Title Expansion)
  const mobileHintToggle = document.getElementById('mobileHintToggle');
  const mobileQuickNav = document.getElementById('mobileQuickNav');

  if (mobileQuickNav) {
    // Default hints state: true (enabled)
    let hintsEnabled = localStorage.getItem('mobile_nav_hints') !== 'false';

    function updateHintToggleUI() {
      if (mobileHintToggle) {
        if (hintsEnabled) {
          mobileHintToggle.classList.add('active');
          mobileHintToggle.setAttribute('title', 'Подсказки включены (нажмите для выключения)');
        } else {
          mobileHintToggle.classList.remove('active');
          mobileHintToggle.setAttribute('title', 'Подсказки выключены (нажмите для включения)');
        }
      }
    }

    updateHintToggleUI();

    if (mobileHintToggle) {
      mobileHintToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hintsEnabled = !hintsEnabled;
        localStorage.setItem('mobile_nav_hints', hintsEnabled ? 'true' : 'false');
        updateHintToggleUI();

        // Collapse any open hints
        const opened = mobileQuickNav.querySelectorAll('.mq-item.show-hint');
        opened.forEach(item => item.classList.remove('show-hint'));
      });
    }

    const mqItems = mobileQuickNav.querySelectorAll('.mq-item');
    mqItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (!hintsEnabled) {
          // Direct navigation if hints mode is disabled
          return;
        }

        // If hints mode is active
        if (!item.classList.contains('show-hint')) {
          // First tap: Expand hint, prevent navigation
          e.preventDefault();
          e.stopPropagation();

          // Collapse other items
          mqItems.forEach(other => {
            if (other !== item) other.classList.remove('show-hint');
          });

          // Expand current item
          item.classList.add('show-hint');

          // Smoothly scroll item into view inside the horizontal bar
          item.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }
        // Second tap: item already has .show-hint, browser follows link naturally!
      });
    });

    // Close hints when clicking anywhere else on page
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#mobileQuickNav') && !e.target.closest('#mobileHintToggle')) {
        mqItems.forEach(item => item.classList.remove('show-hint'));
      }
    });
  }

  // ==========================================================================
  // Interactive Video Embed Player (Home Lightbox + Blog Inline + Post Inline)
  // ==========================================================================
  function parseVideoEmbedUrl(rawVideo) {
    if (!rawVideo || typeof rawVideo !== 'string') return '';
    let value = rawVideo.trim();
    if (!value) return '';

    // 1. Extract src if full <iframe> embed snippet was pasted
    if (/<iframe/i.test(value)) {
      const srcMatch = value.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        value = srcMatch[1].replace(/&amp;/gi, '&').trim();
      }
    }

    // 2. Convert Rutube watch URLs (private & public) to embed URL
    const rutubePrivateMatch = value.match(/rutube\.ru\/video\/private\/([a-zA-Z0-9]+)\/?(\?[^"'\s<>]*)?/i);
    if (rutubePrivateMatch) {
      return `https://rutube.ru/play/embed/${rutubePrivateMatch[1]}/${rutubePrivateMatch[2] || ''}`;
    }

    const rutubePublicMatch = value.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)\/?(\?[^"'\s<>]*)?/i);
    if (rutubePublicMatch) {
      return `https://rutube.ru/play/embed/${rutubePublicMatch[1]}/${rutubePublicMatch[2] || ''}`;
    }

    // 3. Do NOT embed YouTube URLs (RF data collection compliance; keep as external text links only)
    if (/(?:youtu\.be\/|youtube\.com|youtube-nocookie\.com)/i.test(value)) {
      return '';
    }

    // 4. Direct embed URL (Rutube embed, VK video_ext.php, Kinescope, etc.)
    if (/^(https?:)?\/\//i.test(value)) {
      return value;
    }

    return '';
  }

  function withAutoplayParam(url) {
    if (!url || /([?&])autoplay=/i.test(url)) return url;
    const hashIdx = url.indexOf('#');
    const base = hashIdx > -1 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx > -1 ? url.slice(hashIdx) : '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}autoplay=1${hash}`;
  }

  function createVideoIframe(embedUrl, title) {
    const iframe = document.createElement('iframe');
    iframe.src = withAutoplayParam(embedUrl);
    iframe.title = title || 'Видеоплеер';
    iframe.setAttribute(
      'allow',
      'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;'
    );
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    return iframe;
  }

  // Lazy-created Lightbox Modal for Home Page
  let videoLightbox = null;
  let videoLightboxContent = null;

  function closeVideoLightbox() {
    if (!videoLightbox) return;
    videoLightbox.classList.remove('active');
    videoLightbox.setAttribute('aria-hidden', 'true');
    if (videoLightboxContent) {
      videoLightboxContent.innerHTML = '';
    }
    document.body.style.overflow = '';
  }

  function openVideoLightbox(embedUrl, title) {
    if (!videoLightbox) {
      videoLightbox = document.createElement('div');
      videoLightbox.id = 'videoLightboxModal';
      videoLightbox.className = 'video-lightbox-modal';
      videoLightbox.setAttribute('aria-hidden', 'true');
      videoLightbox.innerHTML = `
        <div class="video-lightbox-wrapper" role="dialog" aria-modal="true" aria-label="Видеоплеер">
          <button type="button" class="video-lightbox-close" aria-label="Закрыть видео">&times;</button>
          <div class="video-lightbox-content"></div>
        </div>
      `;
      document.body.appendChild(videoLightbox);

      videoLightboxContent = videoLightbox.querySelector('.video-lightbox-content');
      const closeBtn = videoLightbox.querySelector('.video-lightbox-close');

      closeBtn.addEventListener('click', closeVideoLightbox);
      videoLightbox.addEventListener('click', (e) => {
        if (e.target === videoLightbox) {
          closeVideoLightbox();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && videoLightbox && videoLightbox.classList.contains('active')) {
          closeVideoLightbox();
        }
      });
    }

    videoLightboxContent.replaceChildren(createVideoIframe(embedUrl, title));
    videoLightbox.classList.add('active');
    videoLightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // 1) Home Page: Click thumbnail -> Open Lightbox Modal
  document.querySelectorAll('.news-card-thumb[data-video]').forEach((thumb) => {
    thumb.addEventListener('click', (e) => {
      const embedUrl = parseVideoEmbedUrl(thumb.dataset.video);
      if (!embedUrl) return;
      e.preventDefault();
      const card = thumb.closest('.news-card');
      const titleEl = card ? card.querySelector('.news-title') : null;
      openVideoLightbox(embedUrl, titleEl ? titleEl.textContent.trim() : 'Видео');
    });
  });

  // 2) Blog Feed: Click cover -> Replace cover with inline iframe player inside card
  document.querySelectorAll('.blog-card-cover-link[data-video]').forEach((coverLink) => {
    coverLink.addEventListener('click', (e) => {
      const cover = coverLink.querySelector('.blog-card-cover');
      if (cover && cover.classList.contains('is-playing')) {
        e.preventDefault();
        return;
      }

      const embedUrl = parseVideoEmbedUrl(coverLink.dataset.video);
      if (!embedUrl || !cover) return;

      e.preventDefault();
      const card = coverLink.closest('.blog-card');
      const titleEl = card ? card.querySelector('.blog-title') : null;
      cover.classList.add('is-playing');
      cover.replaceChildren(createVideoIframe(embedUrl, titleEl ? titleEl.textContent.trim() : 'Видео'));
    });
  });

  // 3) Single Post Page: Click top video cover -> Play inline 16:9 iframe
  document.querySelectorAll('.post-video-container[data-video]').forEach((container) => {
    container.addEventListener('click', () => {
      if (container.classList.contains('is-playing')) return;
      const embedUrl = parseVideoEmbedUrl(container.dataset.video);
      if (!embedUrl) return;

      const titleEl = document.querySelector('.post-title');
      container.classList.add('is-playing');
      container.replaceChildren(createVideoIframe(embedUrl, titleEl ? titleEl.textContent.trim() : 'Видео'));
    });
  });
});
