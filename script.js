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
      // Palette: Soft Cyan, Deep Indigo, Warm Gold Accent
      const colors = ['56, 189, 248', '99, 102, 241', '192, 132, 252', '245, 158, 11'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < -this.radius || this.x > width + this.radius) this.vx *= -1;
      if (this.y < -this.radius || this.y > height + this.radius) this.vy *= -1;
    }

    draw() {
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, `rgba(${this.color}, ${this.alpha * 1.5})`);
      grad.addColorStop(0.5, `rgba(${this.color}, ${this.alpha * 0.6})`);
      grad.addColorStop(1, `rgba(${this.color}, 0)`);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // Initialize elements
  const particleCount = Math.min(Math.floor(window.innerWidth / 12), 70);
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  const orbCount = Math.min(Math.floor(window.innerWidth / 160), 12);
  for (let i = 0; i < orbCount; i++) {
    glowingOrbs.push(new GlowingOrb());
  }

  function drawConnections() {
    const maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.25;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw background glowing orbs first
    glowingOrbs.forEach(orb => {
      orb.update();
      orb.draw();
    });

    // Draw particle constellation connections
    drawConnections();

    // Draw particles on top
    particles.forEach(p => {
      p.update();
      p.draw();
    });

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
    }
  }
});
