require("dotenv").config();
const { connectDatabase } = require("./config/database");
const Category = require("./models/Category");
const Product = require("./models/Product");

const data = [
  {
    name: "🍕 Pitsalar",
    products: [
      { name: "Margarita", description: "Pomidor sousi va mozzarella.", price: 55000 },
      { name: "Pepperoni", description: "Pepperoni, mozzarella va pomidor sousi.", price: 75000 },
      { name: "4 Cheese", description: "To‘rt xil pishloq.", price: 85000 }
    ]
  },
  {
    name: "🍔 Burgerlar",
    products: [
      { name: "Classic Burger", description: "Mol go‘shti kotleti, salat va sous.", price: 55000 },
      { name: "Cheese Burger", description: "Mol go‘shti, cheddar va sous.", price: 60000 },
      { name: "Chicken Burger", description: "Tovuq filesi va sabzavotlar.", price: 50000 }
    ]
  },
  {
    name: "🌯 Lavashlar",
    products: [
      { name: "Chicken Lavash", description: "Tovuq, sabzavot va maxsus sous.", price: 40000 },
      { name: "Beef Lavash", description: "Mol go‘shti, sabzavot va sous.", price: 45000 }
    ]
  },
  {
    name: "🍟 Garnirlar",
    products: [
      { name: "French Fries", description: "Qarsildoq kartoshka fri.", price: 20000 },
      { name: "Nuggets", description: "Tovuq nuggets.", price: 30000 }
    ]
  },
  {
    name: "🥤 Ichimliklar",
    products: [
      { name: "Coca-Cola", description: "0.5L.", price: 12000 },
      { name: "Pepsi", description: "0.5L.", price: 12000 },
      { name: "Suv", description: "0.5L.", price: 5000 }
    ]
  }
];

async function seed() {
  await connectDatabase();

  for (let i = 0; i < data.length; i++) {
    const categoryData = data[i];
    let category = await Category.findOne({ name: categoryData.name });
    if (!category) category = await Category.create({ name: categoryData.name, sortOrder: i });

    for (const productData of categoryData.products) {
      await Product.updateOne(
        { name: productData.name, categoryId: category._id },
        { $setOnInsert: { ...productData, categoryId: category._id } },
        { upsert: true }
      );
    }
  }

  console.log("✅ Seed completed");
  process.exit(0);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
