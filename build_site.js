const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const includesDir = path.join(rootDir, '_includes');
const layoutsDir = path.join(rootDir, '_layouts');

const headerHtml = fs.readFileSync(path.join(includesDir, 'header.html'), 'utf8');
const footerHtml = fs.readFileSync(path.join(includesDir, 'footer.html'), 'utf8');

const pages = [
  { file: 'index.html', title: 'Владимир Алексеевич Шемшук — Официальный сайт', active: 'index.html' },
  { file: 'shop.html', title: 'Магазин книг В. А. Шемшука', active: 'shop.html' },
  { file: 'cart.html', title: 'Корзина покупок', active: 'cart.html' },
  { file: 'blog.html', title: 'Блог и статьи В. А. Шемшука', active: 'blog.html' },
  { file: 'shkola.html', title: 'Школа В. А. Шемшука', active: 'shkola.html' },
  { file: 'molitva.html', title: 'Молитва-Треба', active: 'molitva.html' },
  { file: 'ob-avtore.html', title: 'Об авторе — В. А. Шемшук', active: 'ob-avtore.html' },
  { file: 'policy.html', title: 'Политика конфиденциальности', active: 'policy.html' },
  { file: 'terms.html', title: 'Пользовательское соглашение', active: 'terms.html' }
];

function buildHeaderForPage(activePage) {
  let h = headerHtml;

  // Set active link for activePage
  h = h.replace(/class="active"/g, '');
  
  if (activePage === 'index.html') {
    h = h.replace('href="index.html">ГЛАВНАЯ', 'href="index.html" class="active">ГЛАВНАЯ');
  } else if (activePage === 'shop.html') {
    h = h.replace('href="shop.html">МАГАЗИН', 'href="shop.html" class="active">МАГАЗИН');
  } else if (activePage === 'shkola.html') {
    h = h.replace('href="shkola.html">ШКОЛА', 'href="shkola.html" class="active">ШКОЛА');
  } else if (activePage === 'molitva.html') {
    h = h.replace('href="molitva.html">МОЛИТВА-ТРЕБА', 'href="molitva.html" class="active">МОЛИТВА-ТРЕБА');
  } else if (activePage === 'blog.html') {
    h = h.replace('href="blog.html">БЛОГ', 'href="blog.html" class="active">БЛОГ');
  } else if (activePage === 'ob-avtore.html') {
    h = h.replace('href="ob-avtore.html">ОБ АВТОРЕ', 'href="ob-avtore.html" class="active">ОБ АВТОРЕ');
  } else if (activePage === 'cart.html') {
    h = h.replace('class="nav-cart-btn"', 'class="nav-cart-btn active"');
  }
  
  // Clean Liquid tag remnants
  h = h.replace(/\{%\s*if[\s\S]*?%\}/g, '').replace(/\{%\s*endif\s*%\}/g, '');
  return h;
}

pages.forEach(p => {
  const filePath = path.join(rootDir, p.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Strip front matter if present
  content = content.replace(/^---[\s\S]*?---\s*/, '');

  const pageHeader = buildHeaderForPage(p.active);

  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=8">
</head>
<body class="pearl-theme">

  <!-- Dynamic Canvas Background -->
  <canvas id="bg-canvas"></canvas>

${pageHeader}

  <!-- Mobile Drawer -->
  <div class="mobile-drawer" id="mobileDrawer">
    <a href="index.html">ГЛАВНАЯ</a>
    <a href="shop.html">МАГАЗИН</a>
    <a href="cart.html">КОРЗИНА</a>
    <a href="shkola.html">ШКОЛА</a>
    <a href="#">КОНЦЕРТ</a>
    <a href="molitva.html">МОЛИТВА-ТРЕБА</a>
    <a href="blog.html">БЛОГ</a>
    <a href="ob-avtore.html">ОБ АВТОРЕ</a>
    <a href="index.html#contacts">КОНТАКТЫ</a>
  </div>

  <!-- Main Page Container -->
  <main class="page-container">
${content}
  </main>

${footerHtml}

  <script src="cart.js?v=8"></script>
  <script src="shop.js?v=8"></script>
  <script src="cart-page.js?v=8"></script>
  <script src="script.js?v=8"></script>
</body>
</html>
`;

  fs.writeFileSync(filePath, fullHtml, 'utf8');
  console.log(`Built full static HTML for Live Server: ${p.file}`);
});
