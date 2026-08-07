/**
 * Shop Module for V.A. Shemshuk Book Store
 * Handles Quick View Modal & Add to Cart Interactions
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('quickViewModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCover = document.getElementById('modalCoverFull');
    const modalTitle = document.getElementById('modalTitle');
    const modalAuthor = document.getElementById('modalAuthor');
    const modalPrice = document.getElementById('modalPrice');
    const modalDesc = document.getElementById('modalLongDesc');
    const modalSku = document.getElementById('modalSku');
    const modalAddBtn = document.getElementById('modalAddToCartBtn');

    let currentModalBook = null;

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

      if (modalCover) modalCover.src = currentModalBook.coverFull || currentModalBook.thumb;
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
      currentModalBook = null;
    }

    // Delegate Click Events on Shop Grid
    const shopGrid = document.querySelector('.shop-grid');
    if (shopGrid) {
      shopGrid.addEventListener('click', (e) => {
        const quickViewBtn = e.target.closest('.btn-quick-view');
        if (quickViewBtn) {
          e.preventDefault();
          openQuickView(quickViewBtn);
          return;
        }

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
            window.Cart.addToCart(bookData, 1);
            
            // Visual feedback on button
            const origHtml = addCartBtn.innerHTML;
            addCartBtn.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>В корзине</span>
            `;
            addCartBtn.classList.add('added');
            setTimeout(() => {
              addCartBtn.innerHTML = origHtml;
              addCartBtn.classList.remove('added');
            }, 1600);
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
