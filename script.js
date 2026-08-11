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

  function animate() {
    // Only render if browser window is visible and not heavily scrolling (helps mid-range laptops)
    if (!document.hidden && !isScrolling) {
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
  }

  animate();

  // Mobile Menu Drawer Toggle
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');

  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('active');
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
    }
  }
});
