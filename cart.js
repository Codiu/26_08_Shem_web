/**
 * Shopping Cart Module for V.A. Shemshuk Book Store
 * Pure Vanilla JavaScript Client-Side State with LocalStorage
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'shemshuk_books_cart_v1';

  const Cart = {
    // Read cart array from localStorage
    getCart: function () {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        console.error('Error reading cart from localStorage:', e);
        return [];
      }
    },

    // Save cart array to localStorage & notify listeners
    saveCart: function (cart) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        const totals = this.getCartTotals(cart);
        window.dispatchEvent(new CustomEvent('cart:updated', {
          detail: { cart: cart, totals: totals }
        }));
      } catch (e) {
        console.error('Error saving cart to localStorage:', e);
      }
    },

    // Add item to cart
    addToCart: function (book, qty) {
      qty = parseInt(qty, 10) || 1;
      const cart = this.getCart();
      const existingIndex = cart.findIndex(item => item.id === book.id);

      if (existingIndex > -1) {
        cart[existingIndex].quantity += qty;
      } else {
        cart.push({
          id: String(book.id),
          title: String(book.title || 'Книга'),
          price: parseInt(book.price, 10) || 0,
          thumb: book.thumb || '/assets/images/books/thumbs/volhvy.svg',
          quantity: qty
        });
      }

      this.saveCart(cart);
      this.showToast(`«${book.title}» добавлена в корзину`);
    },

    // Update item quantity
    updateQuantity: function (id, qty) {
      qty = parseInt(qty, 10);
      let cart = this.getCart();
      if (qty <= 0) {
        this.removeFromCart(id);
        return;
      }

      const item = cart.find(item => item.id === String(id));
      if (item) {
        item.quantity = qty;
        this.saveCart(cart);
      }
    },

    // Remove single item from cart
    removeFromCart: function (id) {
      let cart = this.getCart();
      cart = cart.filter(item => item.id !== String(id));
      this.saveCart(cart);
    },

    // Clear entire cart
    clearCart: function () {
      localStorage.removeItem(STORAGE_KEY);
      this.saveCart([]);
    },

    // Calculate totals
    getCartTotals: function (customCart) {
      const cart = customCart || this.getCart();
      const count = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
      const total = cart.reduce((sum, item) => sum + ((parseInt(item.price, 10) || 0) * (parseInt(item.quantity, 10) || 0)), 0);
      
      return {
        count: count,
        total: total,
        formattedTotal: new Intl.NumberFormat('ru-RU').format(total) + ' ₽'
      };
    },

    // Update header & floating widgets
    updateHeaderUI: function () {
      const totals = this.getCartTotals();
      
      // Update all badges across header / mobile drawer
      const badges = document.querySelectorAll('.cart-count-badge');
      badges.forEach(badge => {
        badge.textContent = totals.count;
        if (totals.count > 0) {
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      });

      // Update floating cart widget if not on cart.html
      const isCartPage = window.location.pathname.endsWith('cart.html') || window.location.pathname.endsWith('/cart');
      if (!isCartPage) {
        this.updateFloatingWidget(totals);
      }
    },

    // Floating cart widget management
    updateFloatingWidget: function (totals) {
      let widget = document.getElementById('floatingCartWidget');
      if (!widget) {
        widget = document.createElement('a');
        widget.id = 'floatingCartWidget';
        widget.className = 'floating-cart-widget';
        widget.href = 'cart.html';
        widget.setAttribute('title', 'Перейти к оформлению заказа');
        document.body.appendChild(widget);
      }

      if (totals.count > 0) {
        widget.innerHTML = `
          <div class="cart-icon-wrap">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            <span class="cart-count-badge">${totals.count}</span>
          </div>
          <span>Корзина: <strong>${totals.formattedTotal}</strong></span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;
        widget.classList.add('visible');
      } else {
        widget.classList.remove('visible');
      }
    },

    // Show lightweight animated toast
    showToast: function (message) {
      let toastContainer = document.getElementById('cart-toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'cart-toast-container';
        toastContainer.className = 'cart-toast-container';
        document.body.appendChild(toastContainer);
      }

      const toast = document.createElement('div');
      toast.className = 'cart-toast';
      toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${message}</span>
      `;
      toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 10);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }
  };

  // Export to window
  window.Cart = Cart;

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    Cart.updateHeaderUI();

    // Global Add to Cart listener (primarily for index.html / home page)
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.add-to-cart-btn');
      if (addBtn) {
        e.preventDefault();
        const bookId = addBtn.dataset.id;
        const bookTitle = addBtn.dataset.title;
        const bookPrice = addBtn.dataset.price;
        const coverFilename = addBtn.dataset.cover || 'default-cover.svg';
        
        const bookData = {
          id: bookId,
          title: bookTitle,
          price: bookPrice,
          thumb: 'assets/images/books/thumbs/' + coverFilename
        };

        Cart.addToCart(bookData, 1);

        // Visual feedback on the button
        const origHtml = addBtn.innerHTML;
        addBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Добавлено</span>
        `;
        addBtn.classList.add('added');
        setTimeout(() => {
          addBtn.innerHTML = origHtml;
          addBtn.classList.remove('added');
        }, 1600);
      }
    });

    // Listen for custom cart events
    window.addEventListener('cart:updated', () => {
      Cart.updateHeaderUI();
    });

    // Listen for storage events across other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        Cart.updateHeaderUI();
      }
    });
  });

})();
