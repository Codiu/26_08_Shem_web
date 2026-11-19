/**
 * Unified Video Preloader, Pool Manager & Mobile Focus Module
 * - School page (Kinescope): muted autoplay + preload, mobile scroll-to-center zoom with shadow, landscape fullscreen lock.
 * - Home (Lightbox) & Blog / Post (Inline):
 *   1. Auto-preload first video on page.
 *   2. Desktop hover preloads other videos (200ms debounce); cover stays visible until player is ready (no blank flash).
 *   3. Mobile/fast tap preloads immediately with spinner on cover until ready.
 *   4. LRU pool capped at MAX_PRELOADED_SLOTS (4 inactive slots) to keep memory low.
 *   5. Enforces strict single-playback (only 1 video plays at a time via Rutube postMessage + DOM tracking).
 */
(function () {
  'use strict';

  const MAX_PRELOADED_SLOTS = 4;
  const HOVER_PRELOAD_DELAY_MS = 200;
  const AUTO_PRELOAD_DELAY_MS = 450;
  const READY_FALLBACK_DELAY_MS = 600;

  function parseVideoEmbedUrl(rawVideo) {
    if (!rawVideo || typeof rawVideo !== 'string') return '';
    let value = rawVideo.trim();
    if (!value) return '';

    if (/<iframe/i.test(value)) {
      const srcMatch = value.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        value = srcMatch[1].replace(/&amp;/gi, '&').trim();
      }
    }

    const rutubePrivateMatch = value.match(/rutube\.ru\/video\/private\/([a-zA-Z0-9]+)\/?(\?[^"'\s<>]*)?/i);
    if (rutubePrivateMatch) {
      return `https://rutube.ru/play/embed/${rutubePrivateMatch[1]}/${rutubePrivateMatch[2] || ''}`;
    }

    const rutubePublicMatch = value.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)\/?(\?[^"'\s<>]*)?/i);
    if (rutubePublicMatch) {
      return `https://rutube.ru/play/embed/${rutubePublicMatch[1]}/${rutubePublicMatch[2] || ''}`;
    }

    // Never embed YouTube iframes (RF data collection compliance)
    if (/(?:youtu\.be\/|youtube\.com|youtube-nocookie\.com)/i.test(value)) {
      return '';
    }

    if (/^(https?:)?\/\//i.test(value)) {
      return value;
    }

    return '';
  }

  function withQueryParam(url, key, val) {
    if (!url || new RegExp(`([?&])${key}=`, 'i').test(url)) return url;
    const hashIdx = url.indexOf('#');
    const base = hashIdx > -1 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx > -1 ? url.slice(hashIdx) : '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${key}=${val}${hash}`;
  }

  function createVideoIframe(embedUrl, title, autoPlay) {
    const iframe = document.createElement('iframe');
    iframe.src = autoPlay ? withQueryParam(embedUrl, 'autoplay', '1') : embedUrl;
    iframe.title = title || 'Видеоплеер';
    iframe.setAttribute(
      'allow',
      'autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;'
    );
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    return iframe;
  }

  function sendPlayerCommand(iframe, type, data) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ type, data: data || {} }), '*');
    } catch (_) {
      // Cross-origin frame might still be initializing
    }
  }

  // ==========================================================================
  // Global Video Slot Pool & Single-Playback Coordinator
  // ==========================================================================
  const slots = new Map(); // key -> slot object
  let slotSeq = 0;

  function touchSlot(slot) {
    slot.lastUsed = ++slotSeq;
  }

  function pauseSlot(slot) {
    if (!slot) return;
    slot.wantsPlay = false;
    slot.isPlaying = false;
    if (slot.iframe) {
      sendPlayerCommand(slot.iframe, 'player:pause');
    }
  }

  function pauseAllExcept(exceptSlot) {
    slots.forEach((slot) => {
      if (slot !== exceptSlot) {
        pauseSlot(slot);
      }
    });

    // Also pause any unmanaged iframes on the page (if present)
    document.querySelectorAll('iframe').forEach((iframe) => {
      if (!exceptSlot || iframe !== exceptSlot.iframe) {
        sendPlayerCommand(iframe, 'player:pause');
      }
    });
  }

  function evictInactiveSlotsIfNeeded(protectedSlot) {
    // Count preloaded non-playing slots
    const inactive = [];
    slots.forEach((slot) => {
      if (slot !== protectedSlot && slot.iframe && !slot.isPlaying) {
        inactive.push(slot);
      }
    });

    if (inactive.length <= MAX_PRELOADED_SLOTS) return;

    inactive.sort((a, b) => a.lastUsed - b.lastUsed);
    const excess = inactive.length - MAX_PRELOADED_SLOTS;
    for (let i = 0; i < excess; i++) {
      const victim = inactive[i];
      if (typeof victim.teardown === 'function') {
        victim.teardown();
      }
      slots.delete(victim.key);
    }
  }

  function markSlotReady(slot) {
    if (!slot || slot.isReady) return;
    slot.isReady = true;
    clearTimeout(slot.fallbackTimer);
    if (typeof slot.onReady === 'function') {
      slot.onReady();
    }
    if (slot.wantsPlay && slot.iframe) {
      pauseAllExcept(slot);
      sendPlayerCommand(slot.iframe, 'player:play');
      slot.isPlaying = true;
      slot.wantsPlay = false;
    }
  }

  window.addEventListener('message', (event) => {
    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (_) {
        return;
      }
    }
    if (!payload || typeof payload !== 'object') return;

    let matchedSlot = null;
    slots.forEach((slot) => {
      if (slot.iframe && slot.iframe.contentWindow === event.source) {
        matchedSlot = slot;
      }
    });
    if (!matchedSlot) return;

    if (payload.type === 'player:ready') {
      markSlotReady(matchedSlot);
    } else if (payload.type === 'player:changeState' && payload.data) {
      const state = payload.data.state;
      if (state === 'playing' || state === 'buffering') {
        markSlotReady(matchedSlot);
        matchedSlot.isPlaying = true;
        touchSlot(matchedSlot);
        pauseAllExcept(matchedSlot);
      } else if (state === 'paused' || state === 'pause' || state === 'completed' || state === 'stopped') {
        matchedSlot.isPlaying = false;
      }
    }
  });

  // Fullscreen landscape orientation lock helper (Android Chrome/Yandex where supported)
  document.addEventListener('fullscreenchange', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      if (screen.orientation && typeof screen.orientation.unlock === 'function') {
        try {
          screen.orientation.unlock();
        } catch (_) {}
      }
    }
  });

  // ==========================================================================
  // Main Initialization on DOMContentLoaded
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    // ------------------------------------------------------------------------
    // 1) School Page: Kinescope Mobile Scroll-to-Center Focus Zoom
    // ------------------------------------------------------------------------
    const schoolVideoBox = document.querySelector('.video-embed-container[data-mobile-focus-video]');
    if (schoolVideoBox) {
      let ticking = false;
      let isFocused = false;
      let currentShiftX = 0;

      function resetSchoolVideoFocus() {
        isFocused = false;
        currentShiftX = 0;
        schoolVideoBox.classList.remove('is-mobile-focused');
        schoolVideoBox.style.removeProperty('--focus-scale');
        schoolVideoBox.style.removeProperty('--focus-shift-x');
      }

      function updateSchoolVideoFocus() {
        ticking = false;
        const isMobile = window.innerWidth <= 768;
        const fsActive = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

        if (!isMobile || fsActive) {
          if (isFocused) resetSchoolVideoFocus();
          return;
        }

        // offsetWidth ignores CSS transforms, giving the exact unscaled container width
        const naturalWidth = schoolVideoBox.offsetWidth;
        if (!naturalWidth) return;

        const rect = schoolVideoBox.getBoundingClientRect();
        const vpHeight = window.innerHeight;
        const vpWidth = document.documentElement.clientWidth;

        const visible = rect.bottom > 40 && rect.top < vpHeight - 40;
        if (!visible) {
          if (isFocused) resetSchoolVideoFocus();
          return;
        }

        const elemCenterY = rect.top + rect.height / 2;
        const targetCenterY = vpHeight * 0.48;
        const dist = Math.abs(elemCenterY - targetCenterY);

        // Center band ~20-30% of viewport height (enter within +-10%, exit beyond +-15%)
        const enterThreshold = vpHeight * 0.1;
        const exitThreshold = vpHeight * 0.15;

        if (!isFocused && dist <= enterThreshold) {
          isFocused = true;
        } else if (isFocused && dist >= exitThreshold) {
          isFocused = false;
        }

        if (isFocused) {
          const scale = Math.max(1, vpWidth / naturalWidth);
          // Subtract active translateX so measurement stays invariant regardless of scale
          const naturalCenterX = (rect.left + rect.width / 2) - currentShiftX;
          currentShiftX = vpWidth / 2 - naturalCenterX;
          schoolVideoBox.style.setProperty('--focus-scale', scale.toFixed(4));
          schoolVideoBox.style.setProperty('--focus-shift-x', `${currentShiftX.toFixed(1)}px`);
          schoolVideoBox.classList.add('is-mobile-focused');
        } else if (schoolVideoBox.classList.contains('is-mobile-focused')) {
          resetSchoolVideoFocus();
        }
      }

      const scheduleFocusUpdate = () => {
        if (!ticking) {
          window.requestAnimationFrame(updateSchoolVideoFocus);
          ticking = true;
        }
      };

      window.addEventListener('scroll', scheduleFocusUpdate, { passive: true });
      window.addEventListener('resize', scheduleFocusUpdate, { passive: true });
      scheduleFocusUpdate();
    }

    // ------------------------------------------------------------------------
    // 2) Unified Inline Video Preloader (Home + Blog + Single Post)
    // ------------------------------------------------------------------------
    function setupInlineContainer(hoverEl, clickEl, containerEl, key, title, options) {
      const opts = options || {};
      const hoverTarget = hoverEl || clickEl;

      function preloadInline(preloadOpts) {
        const pOpts = preloadOpts || {};
        const embedUrl = parseVideoEmbedUrl(clickEl.dataset.video);
        if (!embedUrl || !containerEl) return null;

        let slot = slots.get(key);
        if (!slot) {
          const iframe = createVideoIframe(embedUrl, title, Boolean(pOpts.autoPlayOnCreate));
          // Insert behind poster image & play overlay (cover stays visible until ready)
          containerEl.insertBefore(iframe, containerEl.firstChild);

          slot = {
            key,
            type: 'inline',
            containerEl,
            iframe,
            isReady: false,
            isPlaying: false,
            wantsPlay: Boolean(pOpts.wantsPlay),
            lastUsed: 0,
            fallbackTimer: null,
            onReady() {
              containerEl.classList.remove('is-loading');
              containerEl.classList.add('is-ready');
              if (slot.wantsPlay || opts.revealOnReady) {
                containerEl.classList.add('is-playing');
              }
            },
            teardown() {
              clearTimeout(slot.fallbackTimer);
              containerEl.classList.remove('is-loading', 'is-ready', 'is-playing');
              if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            }
          };

          iframe.addEventListener('load', () => {
            slot.fallbackTimer = setTimeout(() => markSlotReady(slot), READY_FALLBACK_DELAY_MS);
          });

          slots.set(key, slot);
        }

        touchSlot(slot);
        evictInactiveSlotsIfNeeded(slot);
        return slot;
      }

      let hoverTimer = null;
      if (canHover && hoverTarget) {
        hoverTarget.addEventListener('mouseenter', () => {
          if (containerEl.classList.contains('is-ready') || containerEl.classList.contains('is-playing')) return;
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => {
            preloadInline({ autoPlayOnCreate: false, wantsPlay: false });
          }, HOVER_PRELOAD_DELAY_MS);
        });
        hoverTarget.addEventListener('mouseleave', () => {
          clearTimeout(hoverTimer);
        });
      }

      clickEl.addEventListener('click', (e) => {
        const embedUrl = parseVideoEmbedUrl(clickEl.dataset.video);
        if (!embedUrl || !containerEl) return;

        // If player is already revealed, allow clicking inside iframe naturally
        if (containerEl.classList.contains('is-ready') || containerEl.classList.contains('is-playing')) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        clearTimeout(hoverTimer);

        const existing = slots.get(key);
        const slot = existing || preloadInline({ autoPlayOnCreate: true, wantsPlay: true });
        if (!slot) return;

        pauseAllExcept(slot);
        slot.wantsPlay = true;

        if (slot.isReady) {
          containerEl.classList.remove('is-loading');
          containerEl.classList.add('is-ready', 'is-playing');
          sendPlayerCommand(slot.iframe, 'player:play');
          slot.isPlaying = true;
          slot.wantsPlay = false;
        } else {
          containerEl.classList.add('is-loading');
        }
      });

      return preloadInline;
    }

    // Helper for card lists (Home News & Blog Feed)
    function initInlineFeed(items, buildEntry) {
      const preloaders = [];
      items.forEach((item, idx) => {
        const entry = buildEntry(item, idx);
        if (!entry) return;
        preloaders.push(
          setupInlineContainer(entry.hoverEl, entry.clickEl, entry.containerEl, entry.key, entry.title, {
            revealOnReady: true
          })
        );
      });

      if (preloaders.length > 0) {
        setTimeout(() => {
          preloaders[0]({ autoPlayOnCreate: false, wantsPlay: false });
        }, AUTO_PRELOAD_DELAY_MS);
      }
    }

    // Home Page News Videos (same Variant B inline behavior as Blog)
    initInlineFeed(Array.from(document.querySelectorAll('.news-card-thumb[data-video]')), (thumb, idx) => {
      const card = thumb.closest('.news-card');
      const titleEl = card ? card.querySelector('.news-title') : null;
      return {
        hoverEl: card || thumb,
        clickEl: thumb,
        containerEl: thumb,
        key: `home:${idx}:${thumb.dataset.video}`,
        title: titleEl ? titleEl.textContent.trim() : 'Видео'
      };
    });

    // Blog Feed Videos
    initInlineFeed(Array.from(document.querySelectorAll('.blog-card-cover-link[data-video]')), (coverLink, idx) => {
      const cover = coverLink.querySelector('.blog-card-cover');
      if (!cover) return null;
      const card = coverLink.closest('.blog-card');
      const titleEl = card ? card.querySelector('.blog-title') : null;
      return {
        hoverEl: coverLink,
        clickEl: coverLink,
        containerEl: cover,
        key: `blog:${idx}:${coverLink.dataset.video}`,
        title: titleEl ? titleEl.textContent.trim() : 'Видео'
      };
    });

    // Single Post Page: auto-preload featured video and reveal smoothly when ready
    const postContainer = document.querySelector('.post-video-container[data-video]');
    if (postContainer) {
      const postTitleEl = document.querySelector('.post-title');
      const postTitle = postTitleEl ? postTitleEl.textContent.trim() : 'Видео';
      const postPreloader = setupInlineContainer(
        postContainer,
        postContainer,
        postContainer,
        `post:${postContainer.dataset.video}`,
        postTitle,
        { revealOnReady: true }
      );
      setTimeout(() => {
        postPreloader({ autoPlayOnCreate: false, wantsPlay: false });
      }, AUTO_PRELOAD_DELAY_MS);
    }
  });
})();
