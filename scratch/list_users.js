require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const users = await User.find({});
  console.log(`Total users: ${users.length}`);
  
  for (const u of users) {
    const productsCount = await Product.countDocuments({ seller: u._id });
    const ordersBoughtCount = await Order.countDocuments({ buyer: u._id });
    const ordersSoldCount = await Order.countDocuments({ seller: u._id });
    console.log(`- User ID: ${u._id}
      Name: ${u.name}
      Email: ${u.email}
      Role: ${u.role}
      ProfileComplete: ${u.profileComplete}
      Products owned: ${productsCount}
      Orders bought: ${ordersBoughtCount}
      Orders sold: ${ordersSoldCount}
    `);
  }
  
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
