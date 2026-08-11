/**
 * Shop Module for V.A. Shemshuk Book Store
 * Handles Quick View Modal & Add to Cart Interactions
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('quickViewModal');
    const modalCloseBtn = document.getElementById('modalClose');
    const modalCover = document.getElementById('modalCover');
    const modalTitle = document.getElementById('modalTitle');
    const modalAuthor = document.getElementById('modalAuthor');
    const modalPrice = document.getElementById('modalPrice');
    const modalDesc = document.getElementById('modalDesc');
    const modalSku = document.getElementById('modalSku');
    const modalAddBtn = document.getElementById('modalAddToCartBtn');

    let currentModalBook = null;

    const modalCoverFrame = document.querySelector('.modal-cover-frame');
    if (modalCoverFrame) {
      modalCoverFrame.addEventListener('mouseenter', () => {
        // Find the center of the image relative to the viewport
        const rect = modalCoverFrame.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        
        // Calculate the ratio of the center Y to the viewport height (0 to 1)
        // If image is near the top (e.g. 0.2), transform-origin-y becomes 20%
        // This makes it expand mostly downwards (towards the center).
        // If image is at the center (0.5), it expands equally (50%).
        const originY = (centerY / window.innerHeight) * 100;
        
        // Apply the dynamic origin for a mathematically perfect expansion
        modalCoverFrame.style.transformOrigin = `50% ${originY}%`;
      });

      // We don't need mouseleave to reset it, because the next mouseenter will recalculate it, 
      // and keeping the origin during the mouseleave transition prevents weird snapping.
    }

    // Open Quick View Modal
    function openQuickView(btn) {
      if (!modal) return;

      currentModalBook = {
        id: btn.dataset.id,
        title: btn.dataset.title,
        author: btn.dataset.author,
        price: btn.dataset.price,
        sku: btn.dataset.sku,
        coverFull: btn.dataset.coverFull,
        thumb: btn.dataset.coverThumb,
        longDesc: btn.dataset.longDesc
      };

      if (modalCover) {
        // 1. Instantly display the thumbnail (already in browser cache from the shop grid)
        modalCover.src = currentModalBook.thumb || 'assets/images/books/thumbs/default-cover.svg';
        
        // 2. Clear any previous onerror handler to prevent loops
        modalCover.onerror = () => {
          modalCover.onerror = null;
          modalCover.src = 'assets/images/books/thumbs/default-cover.svg';
        };

        // 3. Progressively load the full resolution cover in the background
        if (currentModalBook.coverFull && currentModalBook.coverFull !== currentModalBook.thumb) {
          const fullImg = new Image();
          fullImg.onload = () => {
            modalCover.src = currentModalBook.coverFull;
            
            // Adjust max-scale based on the real size of the full image
            const naturalH = fullImg.naturalHeight || 600;
            const nativeMaxScale = Math.max(1, naturalH / 420);
            const modalCoverFrame = document.querySelector('.modal-cover-frame');
            if (modalCoverFrame) {
              modalCoverFrame.style.setProperty('--native-max-scale', nativeMaxScale.toFixed(2));
            }
          };
          // We don't need onerror for fullImg because if it fails, we just keep showing the thumbnail!
          fullImg.src = currentModalBook.coverFull;
        } else {
          // If there is no full cover, just calculate max-scale based on the thumbnail
          modalCover.onload = () => {
            const naturalH = modalCover.naturalHeight || 600;
            const nativeMaxScale = Math.max(1, naturalH / 420);
            const modalCoverFrame = document.querySelector('.modal-cover-frame');
            if (modalCoverFrame) {
              modalCoverFrame.style.setProperty('--native-max-scale', nativeMaxScale.toFixed(2));
            }
          };
        }
      }
      if (modalTitle) modalTitle.textContent = currentModalBook.title;
      if (modalAuthor) modalAuthor.textContent = currentModalBook.author;
      if (modalPrice) modalPrice.textContent = new Intl.NumberFormat('ru-RU').format(currentModalBook.price) + ' ₽';
      if (modalDesc) modalDesc.textContent = currentModalBook.longDesc;
      
      if (modalSku) {
        if (currentModalBook.sku && currentModalBook.sku.trim()) {
          modalSku.textContent = 'ISBN: ' + currentModalBook.sku;
          modalSku.style.display = 'inline-block';
        } else {
          modalSku.style.display = 'none';
        }
      }

      modal.classList.add('active');
      document.body.classList.add('modal-open');
    }

    // Close Modal
    function closeModal() {
      if (!modal) return;
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
      if (modalCover) {
        modalCover.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent 1x1 gif
      }
      currentModalBook = null;
    }
    // Delegate Click Events on Shop Grid
    const shopGrid = document.querySelector('.shop-grid');
    if (shopGrid) {
      shopGrid.addEventListener('click', (e) => {
        const addCartBtn = e.target.closest('.btn-add-to-cart');
        if (addCartBtn) {
          e.preventDefault();

          const bookData = {
            id: addCartBtn.dataset.id,
            title: addCartBtn.dataset.title,
            price: addCartBtn.dataset.price,
            thumb: addCartBtn.dataset.thumb
          };
          if (window.Cart) {
            window.Cart.toggleCart(bookData);
            
            // Pulse feedback animation
            addCartBtn.classList.add('added-pulse');
            setTimeout(() => {
              addCartBtn.classList.remove('added-pulse');
            }, 500);
          }
          return;
        }

        const quickViewBtn = e.target.closest('.btn-quick-view');
        if (quickViewBtn) {
          e.preventDefault();
          openQuickView(quickViewBtn);
          return;
        }

        // If clicked on cover image/wrap or title, open quick view modal
        const clickedCoverOrTitle = e.target.closest('.book-cover-wrap, .book-title');
        if (clickedCoverOrTitle) {
          e.preventDefault();
          const card = e.target.closest('.book-card');
          if (card) {
            const cardQuickBtn = card.querySelector('.btn-quick-view');
            if (cardQuickBtn) {
              openQuickView(cardQuickBtn);
            }
          }
        }
      });
    }

    // Modal Add To Cart
    if (modalAddBtn) {
      modalAddBtn.addEventListener('click', () => {
        if (currentModalBook && window.Cart) {
          window.Cart.addToCart({
            id: currentModalBook.id,
            title: currentModalBook.title,
            price: currentModalBook.price,
            thumb: currentModalBook.thumb
          }, 1);
          closeModal();
        }
      });
    }

    // Modal Close Triggers
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
          closeModal();
        }
      });
    }

    // Escape Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        closeModal();
      }
    });

  });
})();
