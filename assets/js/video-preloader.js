/**
 * Unified Video Preloader, Playback Coordinator & Mobile Focus Module
 * - School page (Kinescope): official IFrame API (muted autoplay + preload) + desktop Unmute pill.
 * - Mobile Focus ([data-mobile-focus-video]): symmetric +-10% center band on <=768px for School ("always") & Blog ("ready-only").
 * - Home page: clean cover thumbnails + Lightbox modal with blurred cover & visible loading spinner/label.
 * - Blog & Post: Variant B inline player (auto-preload #1, hover/tap preloads rest without blank flash, LRU cap 4, 1 playing max).
 */
(function () {
  'use strict';

  const MAX_PRELOADED_SLOTS = 4;
  const HOVER_PRELOAD_DELAY_MS = 200;
  const AUTO_PRELOAD_DELAY_MS = 450;
  const READY_FALLBACK_DELAY_MS = 650;

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
  const slots = new Map();
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

    document.querySelectorAll('iframe').forEach((iframe) => {
      if (!exceptSlot || iframe !== exceptSlot.iframe) {
        sendPlayerCommand(iframe, 'player:pause');
      }
    });
  }

  function evictInactiveSlotsIfNeeded(protectedSlot) {
    const inactive = [];
    slots.forEach((slot) => {
      if (slot !== protectedSlot && slot.type === 'inline' && slot.iframe && !slot.isPlaying) {
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
    // 1) Shared Symmetric Mobile Center-Focus Module (School + Blog)
    // ------------------------------------------------------------------------
    const mobileFocusShiftMap = new WeakMap();
    let mobileFocusTicking = false;

    function clearMobileFocus(el) {
      mobileFocusShiftMap.delete(el);
      el.classList.remove('is-mobile-focused');
      el.style.removeProperty('--focus-scale');
      el.style.removeProperty('--focus-shift-x');
      const card = el.closest('.blog-card, .school-video-card');
      if (card) card.classList.remove('has-mobile-focused-video');
    }

    function isMobileFocusEligible(el) {
      const mode = el.getAttribute('data-mobile-focus-video');
      if (mode === 'ready-only') {
        return el.classList.contains('is-ready') || el.classList.contains('is-playing');
      }
      return true;
    }

    function updateAllMobileVideoFocus() {
      mobileFocusTicking = false;
      const targets = Array.from(document.querySelectorAll('[data-mobile-focus-video]'));
      if (targets.length === 0) return;

      const isMobile = window.innerWidth <= 768;
      const fsActive = Boolean(document.fullscreenElement || document.webkitFullscreenElement);

      if (!isMobile || fsActive) {
        targets.forEach(clearMobileFocus);
        return;
      }

      const vpHeight = window.innerHeight;
      const vpWidth = document.documentElement.clientWidth;
      const targetCenterY = vpHeight * 0.5;
      // Strict single symmetric band around viewport center (+-10% = 20% center zone)
      const symmetricThreshold = vpHeight * 0.1;

      let bestTarget = null;
      let bestDist = Infinity;

      targets.forEach((el) => {
        if (!isMobileFocusEligible(el)) return;
        const naturalWidth = el.offsetWidth;
        if (!naturalWidth) return;

        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 20 || rect.top >= vpHeight - 20) return;

        const elemCenterY = rect.top + rect.height / 2;
        const dist = Math.abs(elemCenterY - targetCenterY);
        if (dist <= symmetricThreshold && dist < bestDist) {
          bestDist = dist;
          bestTarget = { el, rect, naturalWidth };
        }
      });

      targets.forEach((el) => {
        if (!bestTarget || el !== bestTarget.el) {
          if (el.classList.contains('is-mobile-focused')) {
            clearMobileFocus(el);
          }
        }
      });

      if (bestTarget) {
        const { el, rect, naturalWidth } = bestTarget;
        const scale = Math.max(1, vpWidth / naturalWidth);
        const prevShift = mobileFocusShiftMap.get(el) || 0;
        const naturalCenterX = (rect.left + rect.width / 2) - prevShift;
        const nextShiftX = vpWidth / 2 - naturalCenterX;

        mobileFocusShiftMap.set(el, nextShiftX);
        el.style.setProperty('--focus-scale', scale.toFixed(4));
        el.style.setProperty('--focus-shift-x', `${nextShiftX.toFixed(1)}px`);
        el.classList.add('is-mobile-focused');

        const card = el.closest('.blog-card, .school-video-card');
        if (card) card.classList.add('has-mobile-focused-video');
      }
    }

    function scheduleMobileFocusUpdate() {
      if (!mobileFocusTicking) {
        window.requestAnimationFrame(updateAllMobileVideoFocus);
        mobileFocusTicking = true;
      }
    }

    if (document.querySelector('[data-mobile-focus-video]')) {
      window.addEventListener('scroll', scheduleMobileFocusUpdate, { passive: true });
      window.addEventListener('resize', scheduleMobileFocusUpdate, { passive: true });
      scheduleMobileFocusUpdate();
    }

    // ------------------------------------------------------------------------
    // 2) School Page: Kinescope IFrame API + Desktop Unmute Pill
    // ------------------------------------------------------------------------
    const schoolPlayerHost = document.getElementById('schoolKinescopePlayer');
    const schoolUnmuteBtn = document.getElementById('schoolUnmuteBtn');
    if (schoolPlayerHost) {
      const videoId = schoolPlayerHost.getAttribute('data-kinescope-id');
      let kinescopeInitialized = false;

      function mountFallbackSchoolIframe() {
        if (kinescopeInitialized || schoolPlayerHost.querySelector('iframe')) return;
        kinescopeInitialized = true;
        const iframe = createVideoIframe(
          `https://kinescope.io/embed/${videoId}?autoplay=1&muted=1&preload=true`,
          'Русская жреческая школа',
          false
        );
        schoolPlayerHost.replaceChildren(iframe);
      }

      if (videoId) {
        window.onKinescopeIframeAPIReady = function (playerFactory) {
          if (kinescopeInitialized) return;
          kinescopeInitialized = true;

          playerFactory.create('schoolKinescopePlayer', {
            url: `https://kinescope.io/${videoId}`,
            size: { width: '100%', height: '100%' },
            behavior: {
              autoPlay: true,
              muted: true
            }
          }).then((player) => {
            if (!schoolUnmuteBtn) return;

            const syncUnmuteButton = (muted) => {
              schoolUnmuteBtn.hidden = !muted;
            };

            syncUnmuteButton(true);
            if (typeof player.isMuted === 'function') {
              Promise.resolve(player.isMuted()).then((muted) => syncUnmuteButton(Boolean(muted))).catch(() => {});
            }

            if (player.Events && player.Events.VolumeChange) {
              player.on(player.Events.VolumeChange, (ev) => {
                if (ev && ev.data) {
                  syncUnmuteButton(Boolean(ev.data.muted) || ev.data.volume === 0);
                }
              });
            }

            schoolUnmuteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (typeof player.unmute === 'function') {
                Promise.resolve(player.unmute()).then(() => {
                  if (typeof player.setVolume === 'function') {
                    return player.setVolume(1);
                  }
                }).catch(() => {});
              }
              syncUnmuteButton(false);
            });
          }).catch(() => {
            kinescopeInitialized = false;
            mountFallbackSchoolIframe();
          });
        };

        const apiScript = document.createElement('script');
        apiScript.src = 'https://player.kinescope.io/latest/iframe.player.js';
        apiScript.async = true;
        apiScript.onerror = mountFallbackSchoolIframe;
        document.head.appendChild(apiScript);

        // Safety timeout if Kinescope API CDN is blocked
        setTimeout(mountFallbackSchoolIframe, 3500);
      }
    }

    // ------------------------------------------------------------------------
    // 3) Home Page: Lightbox Modal on Click (Clean Thumbnail + Visible Loader)
    // ------------------------------------------------------------------------
    let videoLightbox = null;
    let videoLightboxContent = null;
    let activeLightboxSlot = null;

    function ensureLightboxModal() {
      if (videoLightbox) return;
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

    function closeVideoLightbox() {
      if (!videoLightbox) return;
      videoLightbox.classList.remove('active');
      videoLightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (activeLightboxSlot) {
        clearTimeout(activeLightboxSlot.fallbackTimer);
        slots.delete(activeLightboxSlot.key);
        activeLightboxSlot = null;
      }
      if (videoLightboxContent) {
        videoLightboxContent.innerHTML = '';
      }
    }

    function openHomeVideoLightbox(thumb) {
      const embedUrl = parseVideoEmbedUrl(thumb.dataset.video);
      if (!embedUrl) return;

      ensureLightboxModal();
      closeVideoLightbox();

      const card = thumb.closest('.news-card');
      const titleEl = card ? card.querySelector('.news-title') : null;
      const posterImg = thumb.querySelector('img');
      const title = titleEl ? titleEl.textContent.trim() : 'Видео';

      const holder = document.createElement('div');
      holder.className = 'video-lightbox-slot active';

      const poster = document.createElement('div');
      poster.className = 'video-slot-poster';
      if (posterImg && posterImg.getAttribute('src')) {
        const img = document.createElement('img');
        img.src = posterImg.getAttribute('src');
        img.alt = title;
        poster.appendChild(img);
      }

      const loaderWrap = document.createElement('div');
      loaderWrap.className = 'video-slot-loader';
      loaderWrap.innerHTML = '<div class="video-slot-spinner"></div><span class="video-slot-loading-text">Загрузка видео...</span>';
      poster.appendChild(loaderWrap);

      const iframe = createVideoIframe(embedUrl, title, true);
      holder.appendChild(iframe);
      holder.appendChild(poster);
      videoLightboxContent.replaceChildren(holder);

      const slot = {
        key: `home-modal:${embedUrl}`,
        type: 'lightbox',
        iframe,
        isReady: false,
        isPlaying: true,
        wantsPlay: false,
        lastUsed: ++slotSeq,
        fallbackTimer: null,
        onReady() {
          holder.classList.add('is-ready');
        }
      };

      iframe.addEventListener('load', () => {
        slot.fallbackTimer = setTimeout(() => markSlotReady(slot), READY_FALLBACK_DELAY_MS);
      });

      slots.set(slot.key, slot);
      activeLightboxSlot = slot;
      pauseAllExcept(slot);

      videoLightbox.classList.add('active');
      videoLightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    document.querySelectorAll('.news-card-thumb[data-video]').forEach((thumb) => {
      thumb.addEventListener('click', (e) => {
        if (!parseVideoEmbedUrl(thumb.dataset.video)) return;
        e.preventDefault();
        openHomeVideoLightbox(thumb);
      });
    });

    // ------------------------------------------------------------------------
    // 4) Blog Feed & Single Post Inline Preloader (Variant B)
    // ------------------------------------------------------------------------
    function setupInlineContainer(triggerEl, containerEl, key, title) {
      function preloadInline(preloadOpts) {
        const pOpts = preloadOpts || {};
        const embedUrl = parseVideoEmbedUrl(triggerEl.dataset.video);
        if (!embedUrl || !containerEl) return null;

        let slot = slots.get(key);
        if (!slot) {
          const iframe = createVideoIframe(embedUrl, title, Boolean(pOpts.autoPlayOnCreate));
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
              containerEl.classList.add('is-ready', 'is-playing');
              scheduleMobileFocusUpdate();
            },
            teardown() {
              clearTimeout(slot.fallbackTimer);
              containerEl.classList.remove('is-loading', 'is-ready', 'is-playing');
              clearMobileFocus(containerEl);
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
      if (canHover) {
        triggerEl.addEventListener('mouseenter', () => {
          if (containerEl.classList.contains('is-ready') || containerEl.classList.contains('is-playing')) return;
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => {
            preloadInline({ autoPlayOnCreate: false, wantsPlay: false });
          }, HOVER_PRELOAD_DELAY_MS);
        });
        triggerEl.addEventListener('mouseleave', () => {
          clearTimeout(hoverTimer);
        });
      }

      triggerEl.addEventListener('click', (e) => {
        const embedUrl = parseVideoEmbedUrl(triggerEl.dataset.video);
        if (!embedUrl || !containerEl) return;

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
          scheduleMobileFocusUpdate();
        } else {
          containerEl.classList.add('is-loading');
        }
      });

      return preloadInline;
    }

    // Blog Feed
    const blogTriggers = Array.from(document.querySelectorAll('.blog-card-cover-link[data-video]'));
    const blogPreloaders = [];
    blogTriggers.forEach((coverLink, idx) => {
      const cover = coverLink.querySelector('.blog-card-cover');
      const card = coverLink.closest('.blog-card');
      const titleEl = card ? card.querySelector('.blog-title') : null;
      const title = titleEl ? titleEl.textContent.trim() : 'Видео';
      if (!cover) return;

      blogPreloaders.push(
        setupInlineContainer(coverLink, cover, `blog:${idx}:${coverLink.dataset.video}`, title)
      );
    });

    if (blogPreloaders.length > 0) {
      setTimeout(() => {
        blogPreloaders[0]({ autoPlayOnCreate: false, wantsPlay: false });
      }, AUTO_PRELOAD_DELAY_MS);
    }

    // Single Post Page
    const postContainer = document.querySelector('.post-video-container[data-video]');
    if (postContainer) {
      const postTitleEl = document.querySelector('.post-title');
      const postTitle = postTitleEl ? postTitleEl.textContent.trim() : 'Видео';
      const postPreloader = setupInlineContainer(
        postContainer,
        postContainer,
        `post:${postContainer.dataset.video}`,
        postTitle
      );
      setTimeout(() => {
        postPreloader({ autoPlayOnCreate: false, wantsPlay: false });
      }, AUTO_PRELOAD_DELAY_MS);
    }
  });
})();
