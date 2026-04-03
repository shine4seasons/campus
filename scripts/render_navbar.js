const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
(async () => {
  try {
    const file = path.join(__dirname, '..', 'views', 'partials', 'navbar.ejs');
    const tpl = fs.readFileSync(file, 'utf8');
    const html = ejs.render(tpl, { user: { name: 'Test Seller', email: 'seller@example.com', avatar: '', role: 'seller' }, isLoginPage: false });
    console.log(html);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
