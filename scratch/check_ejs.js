
const fs = require('fs');
const content = fs.readFileSync('views/product.ejs', 'utf8');
const regex = /<%[=-]?([\s\S]*?)%>/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const code = match[1];
    try {
        // Wrap code in a dummy function to check syntax
        // Note: this won't work perfectly for multi-line control flow blocks
        // But it can catch simple typos.
        // Actually, let's just log the code.
        console.log('--- CODE START ---');
        console.log(code);
        console.log('--- CODE END ---');
    } catch (e) {
        console.error('ERROR in block:', code);
        console.error(e);
    }
}
