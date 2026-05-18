const PDFDocument = require('pdfkit');

/**
 * Generate a PDF invoice for an order
 * @param {Object} order - The order object with populated buyer, seller, and product
 * @returns {Promise<Buffer>} - The generated PDF as a buffer
 */
async function generateOrderInvoice(order) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                let pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Header
            doc.fillColor('#444444')
               .fontSize(20)
               .text('CAMPUS MARKETPLACE', 50, 50)
               .fontSize(10)
               .text('Invoice #' + order._id.toString().substring(0, 8).toUpperCase(), 200, 50, { align: 'right' })
               .text('Date: ' + new Date().toLocaleDateString(), 200, 65, { align: 'right' })
               .moveDown();

            // Divider
            doc.moveTo(50, 90).lineTo(550, 90).stroke('#eeeeee');

            // Order Info
            doc.fontSize(12).fillColor('#333333');
            doc.text('Order Details', 50, 110, { underline: true });
            doc.fontSize(10);
            doc.text('Status: ' + order.status.toUpperCase(), 50, 130);
            doc.text('Payment Method: ' + (order.paymentMode === 'card' ? 'Card' : 'Cash'), 50, 145);
            doc.text('Delivery Method: ' + (order.deliveryMode === 'ship' ? 'Shipping' : 'Pickup'), 50, 160);

            // Buyer & Seller
            doc.fontSize(12).text('Buyer Information', 50, 190, { underline: true });
            doc.fontSize(10);
            doc.text('Name: ' + (order.buyer?.name || 'Unknown'), 50, 210);
            doc.text('Email: ' + (order.buyer?.email || 'N/A'), 50, 225);

            doc.fontSize(12).text('Seller Information', 300, 190, { underline: true });
            doc.fontSize(10);
            doc.text('Name: ' + (order.seller?.name || 'Unknown'), 300, 210);
            doc.text('University: ' + (order.seller?.university || 'N/A'), 300, 225);

            // Table Header
            const tableTop = 270;
            doc.fontSize(12).fillColor('#333333');
            doc.text('Item Description', 50, tableTop);
            doc.text('Quantity', 350, tableTop);
            doc.text('Price', 450, tableTop, { align: 'right' });

            doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke('#eeeeee');

            // Table Body
            const itemTop = tableTop + 35;
            doc.fontSize(10);
            doc.text(order.product?.title || 'Product', 50, itemTop);
            doc.text('1', 350, itemTop);
            doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(order.priceSnapshot || 0), 450, itemTop, { align: 'right' });

            // Total
            const totalTop = itemTop + 50;
            doc.moveTo(350, totalTop).lineTo(550, totalTop).stroke('#eeeeee');
            doc.fontSize(14).fillColor('#1D6AE5');
            doc.text('TOTAL', 350, totalTop + 15);
            doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(order.priceSnapshot || 0), 450, totalTop + 15, { align: 'right' });

            // Footer
            doc.fontSize(10).fillColor('#888888');
            doc.text('Thank you for shopping at Campus Marketplace!', 50, 700, { align: 'center', width: 500 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Generate a PDF report for a list of users
 * @param {Array} users - List of users
 * @returns {Promise<Buffer>}
 */
async function generateUsersReport(users) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, layout: 'landscape' });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Header
            doc.fillColor('#1D6AE5').fontSize(20).text('USER DIRECTORY REPORT', 40, 40);
            doc.fillColor('#444444').fontSize(10).text('Total Users: ' + users.length, 40, 65);
            doc.text('Generated on: ' + new Date().toLocaleString(), 40, 80);
            doc.moveDown();

            // Table Header
            const tableTop = 110;
            doc.fontSize(10).fillColor('#333333');
            doc.text('Name', 40, tableTop, { width: 150 });
            doc.text('Email', 190, tableTop, { width: 200 });
            doc.text('University', 390, tableTop, { width: 150 });
            doc.text('Joined', 540, tableTop, { width: 80 });
            doc.text('Role', 620, tableTop, { width: 60 });
            doc.text('Status', 680, tableTop, { width: 60 });

            doc.moveTo(40, tableTop + 15).lineTo(750, tableTop + 15).stroke('#dddddd');

            // Rows
            let y = tableTop + 25;
            users.forEach((u, i) => {
                if (y > 500) { doc.addPage(); y = 50; }
                
                doc.fontSize(9).fillColor('#444444');
                doc.text(u.nickname || u.name || '—', 40, y, { width: 150 });
                doc.text(u.email || '—', 190, y, { width: 200 });
                doc.text(u.university || '—', 390, y, { width: 150 });
                doc.text(u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—', 540, y);
                doc.text(u.role || 'user', 620, y);
                doc.fillColor(u.banned ? '#EF4444' : '#10B981').text(u.banned ? 'Banned' : 'Active', 680, y);
                
                y += 20;
                if (i < users.length - 1) doc.moveTo(40, y - 5).lineTo(750, y - 5).stroke('#f3f4f6');
            });

            doc.end();
        } catch (err) { reject(err); }
    });
}

/**
 * Generate a PDF report for seller orders
 */
async function generateSellerOrdersReport(orders, sellerName) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, layout: 'landscape' });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.fillColor('#10B981').fontSize(18).text('SALES REPORT: ' + sellerName.toUpperCase(), 40, 40);
            doc.fillColor('#666666').fontSize(10).text('Total Transactions: ' + orders.length, 40, 65);
            
            const tableTop = 100;
            doc.fontSize(10).fillColor('#333333');
            doc.text('Order ID', 40, tableTop);
            doc.text('Product', 120, tableTop);
            doc.text('Buyer', 320, tableTop);
            doc.text('Price', 450, tableTop);
            doc.text('Date', 550, tableTop);
            doc.text('Status', 650, tableTop);

            doc.moveTo(40, tableTop + 15).lineTo(750, tableTop + 15).stroke('#dddddd');

            let y = tableTop + 25;
            let totalRev = 0;
            orders.forEach(o => {
                if (y > 500) { doc.addPage(); y = 50; }
                doc.fontSize(9).fillColor('#444444');
                doc.text(o._id.toString().substring(18).toUpperCase(), 40, y);
                doc.text(o.product?.title || '—', 120, y, { width: 190 });
                doc.text(o.buyer?.nickname || o.buyer?.name || '—', 320, y);
                doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(o.priceSnapshot || 0), 450, y);
                doc.text(new Date(o.createdAt).toLocaleDateString(), 550, y);
                doc.text(o.status, 650, y);
                if (o.status === 'completed') totalRev += (o.priceSnapshot || 0);
                y += 25;
            });

            doc.moveTo(450, y).lineTo(750, y).stroke('#10B981');
            doc.fontSize(12).fillColor('#10B981').text('Total Revenue: ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(totalRev), 450, y + 10);

            doc.end();
        } catch (err) { reject(err); }
    });
}

/**
 * Generate a PDF report for system analytics
 */
async function generateSystemReport(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.fillColor('#1D6AE5').fontSize(24).text('SYSTEM PERFORMANCE REPORT', 50, 50);
            doc.fontSize(10).fillColor('#666666').text('Platform: Campus Marketplace', 50, 80);
            doc.text('Report Period: Last 30 Days', 50, 95);
            doc.text('Generated: ' + new Date().toLocaleString(), 50, 110);

            // KPI Grid
            doc.rect(50, 140, 500, 100).fill('#f8fafc');
            doc.fillColor('#333333').fontSize(14).text('Key Performance Indicators', 65, 155);
            
            doc.fontSize(10);
            doc.text('Total Registered Users:', 65, 185);
            doc.text(data.totalUsers.toLocaleString(), 200, 185, { bold: true });
            
            doc.text('Active Products:', 65, 205);
            doc.text((data.activeProducts || 0).toLocaleString(), 200, 205);

            doc.text('Monthly Revenue (GMV):', 300, 185);
            doc.fillColor('#16a34a').text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(data.gmvThisMonth), 430, 185);
            
            doc.fillColor('#333333').text('Monthly Orders:', 300, 205);
            doc.text(data.ordersThisMonth.toString(), 430, 205);

            // Order Distribution
            doc.fontSize(14).text('Order Status Distribution', 50, 270);
            let sy = 300;
            Object.keys(data.ordersByStatus).forEach(status => {
                doc.fontSize(10).text(status.toUpperCase() + ':', 70, sy);
                doc.text(data.ordersByStatus[status].toString(), 200, sy);
                sy += 20;
            });

            doc.end();
        } catch (err) { reject(err); }
    });
}

module.exports = {
    generateOrderInvoice,
    generateUsersReport,
    generateSellerOrdersReport,
    generateSystemReport
};
