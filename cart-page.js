/**
 * Cart & Checkout Page Controller
 * Handles table rendering, quantity updates, total calculations, and Web3Forms submission
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmptyState');
    const cartContent = document.getElementById('cartContentLayout');
    const subtotalEl = document.getElementById('cartSubtotal');
    const grandTotalEl = document.getElementById('cartGrandTotal');
    const checkoutForm = document.getElementById('checkoutForm');
    const orderItemsField = document.getElementById('orderItemsField');
    const orderTotalField = document.getElementById('orderTotalField');
    const submitBtn = document.getElementById('checkoutSubmitBtn');
    const orderSuccessView = document.getElementById('orderSuccessView');

    function renderCartPage() {
      if (!window.Cart) return;

      const cart = window.Cart.getCart();
      const totals = window.Cart.getCartTotals(cart);

      if (cart.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (cartContent) cartContent.style.display = 'none';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (cartContent) cartContent.style.display = 'grid';

      if (cartItemsContainer) {
        cartItemsContainer.innerHTML = cart.map(item => {
          const itemTotal = (item.price * item.quantity);
          const formattedItemTotal = new Intl.NumberFormat('ru-RU').format(itemTotal) + ' ₽';
          const formattedPrice = new Intl.NumberFormat('ru-RU').format(item.price) + ' ₽';

          return `
            <div class="cart-item-row" data-id="${item.id}">
              <div class="cart-item-info">
                <img src="${item.thumb}" alt="${item.title}" class="cart-item-thumb" onerror="this.src='/assets/images/books/thumbs/volhvy.svg'">
                <div class="cart-item-details">
                  <h4 class="cart-item-title">${item.title}</h4>
                  <span class="cart-item-unit-price">${formattedPrice} / шт.</span>
                </div>
              </div>

              <div class="cart-item-qty">
                <div class="qty-control">
                  <button type="button" class="btn-qty-minus" data-id="${item.id}" aria-label="Уменьшить">-</button>
                  <input type="number" class="qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="99" readonly>
                  <button type="button" class="btn-qty-plus" data-id="${item.id}" aria-label="Увеличить">+</button>
                </div>
              </div>

              <div class="cart-item-subtotal">
                <span class="subtotal-val">${formattedItemTotal}</span>
              </div>

              <div class="cart-item-remove">
                <button type="button" class="btn-item-remove" data-id="${item.id}" title="Удалить из заказа">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      if (subtotalEl) subtotalEl.textContent = totals.formattedTotal;
      if (grandTotalEl) grandTotalEl.textContent = totals.formattedTotal;
    }

    // Initial render
    renderCartPage();

    // Re-render when cart changes
    window.addEventListener('cart:updated', () => {
      renderCartPage();
    });

    // Handle Quantity and Remove Events
    if (cartItemsContainer) {
      cartItemsContainer.addEventListener('click', (e) => {
        const minusBtn = e.target.closest('.btn-qty-minus');
        if (minusBtn) {
          const id = minusBtn.dataset.id;
          const item = window.Cart.getCart().find(i => i.id === id);
          if (item) {
            window.Cart.updateQuantity(id, item.quantity - 1);
          }
          return;
        }

        const plusBtn = e.target.closest('.btn-qty-plus');
        if (plusBtn) {
          const id = plusBtn.dataset.id;
          const item = window.Cart.getCart().find(i => i.id === id);
          if (item) {
            window.Cart.updateQuantity(id, item.quantity + 1);
          }
          return;
        }

        const removeBtn = e.target.closest('.btn-item-remove');
        if (removeBtn) {
          const id = removeBtn.dataset.id;
          window.Cart.removeFromCart(id);
          return;
        }
      });
    }

    // Checkout Form Submission (Web3Forms AJAX)
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cart = window.Cart.getCart();
        if (cart.length === 0) {
          alert('Ваша корзина пуста.');
          return;
        }

        const totals = window.Cart.getCartTotals(cart);

        // Build textual structured order list
        let orderSummaryText = `СОСТАВ ЗАКАЗА (КНИГИ):\n`;
        orderSummaryText += `==============================\n`;
        cart.forEach((item, index) => {
          const itemSum = item.price * item.quantity;
          orderSummaryText += `${index + 1}. «${item.title}» — ${item.quantity} шт. х ${item.price} ₽ = ${itemSum} ₽\n`;
        });
        orderSummaryText += `==============================\n`;
        orderSummaryText += `ИТОГО К ОПЛАТЕ: ${totals.formattedTotal} (${totals.count} товаров)\n`;

        const clientLastName = document.getElementById('clientLastName')?.value || '';
        const clientFirstName = document.getElementById('clientFirstName')?.value || '';
        const clientMiddleName = document.getElementById('clientMiddleName')?.value || '';
        const clientPhone = document.getElementById('clientPhone')?.value || '';
        const clientEmail = document.getElementById('clientEmail')?.value || '';
        const clientZip = document.getElementById('clientZip')?.value || '';
        const clientCity = document.getElementById('clientCity')?.value || '';
        const clientAddress = document.getElementById('clientAddress')?.value || '';
        const clientNotes = document.getElementById('clientNotes')?.value || '';

        let fullMessage = `📦 СОСТАВ ЗАКАЗА:\n`;
        fullMessage += `-------------------------------------------\n`;
        cart.forEach((item, index) => {
          fullMessage += `${index + 1}. ${item.title}\n   Стоимость: ${item.price}\n`;
        });
        fullMessage += `-------------------------------------------\n`;
        fullMessage += `💰 ИТОГО: ${totals.formattedTotal}\n\n`;

        fullMessage += `👤 КОНТАКТНЫЕ ДАННЫЕ:\n`;
        fullMessage += `-------------------------------------------\n`;
        fullMessage += `Покупатель: ${clientLastName} ${clientFirstName} ${clientMiddleName}`.trim() + `\n`;
        fullMessage += `Телефон: ${clientPhone}\n`;
        fullMessage += `Email: ${clientEmail}\n\n`;

        fullMessage += `🚚 ДОСТАВКА:\n`;
        fullMessage += `-------------------------------------------\n`;
        fullMessage += `Адрес: ${clientZip}, г. ${clientCity}, ${clientAddress}\n`;
        
        if (clientNotes) {
          fullMessage += `\n📝 ПРИМЕЧАНИЯ К ЗАКАЗУ:\n`;
          fullMessage += `-------------------------------------------\n`;
          fullMessage += `${clientNotes}\n`;
        }

        if (orderItemsField) orderItemsField.value = fullMessage;
        if (orderTotalField) orderTotalField.value = totals.formattedTotal;

        // Visual loading state on button
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <span class="spinner-icon"></span>
            <span>Отправка заказа...</span>
          `;
        }

        const EMAILJS_PUBLIC_KEY = 'ZBY1t1jhJbqinZJYe';
        const EMAILJS_SERVICE_ID = 'service_u6tcyvm'; 
        const EMAILJS_TEMPLATE_ID = 'template_t4flego'; 

        const templateParams = {
          customer_name: `${clientFirstName} ${clientLastName}`,
          customer_email: clientEmail,
          email: clientEmail, // Added for the TO: {{email}} field
          customer_phone: clientPhone,
          message: fullMessage
        };

        try {
          const response = await emailjs.send(
            EMAILJS_SERVICE_ID, 
            EMAILJS_TEMPLATE_ID, 
            templateParams, 
            EMAILJS_PUBLIC_KEY
          );

          if (response.status === 200) {
            // Clear cart
            window.Cart.clearCart();

            // Show Success View
            if (cartContent) cartContent.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
            if (orderSuccessView) orderSuccessView.style.display = 'block';

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            throw new Error('EmailJS returned status ' + response.status);
          }
        } catch (error) {
          console.error('Submission error:', error);
          const errorMsg = error.text || error.message || 'Неизвестная ошибка';
          alert('Ошибка EmailJS: ' + errorMsg + '\n\nУбедитесь, что Service ID, Template ID верны и домен разрешен в настройках EmailJS.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Подтвердить и оформить заказ</span>`;
          }
        }
      });
    }

  });
})();
