// latency-test.js
// Ishlatish: node latency-test.js
// Hozirgi MONGO_URI bilan bazaga necha millisekundda
// javob kelayotganini o'lchaydi (3 marta o'rtachasini oladi).

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error("❌ .env ichida MONGO_URI yoki DATABASE_URL topilmadi.");
        process.exit(1);
    }

    console.log("⏳ Ulanmoqda...");
    const connectStart = Date.now();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`✅ Ulandi: ${Date.now() - connectStart}ms`);

    const timings = [];
    for (let i = 1; i <= 5; i++) {
        const start = Date.now();
        await mongoose.connection.db.admin().ping();
        const ms = Date.now() - start;
        timings.push(ms);
        console.log(`📡 So'rov ${i}: ${ms}ms`);
    }

    const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
    console.log(`\n📊 O'rtacha javob vaqti: ${avg}ms`);

    if (avg > 200) {
        console.log("🔴 Bu YUQORI kechikish — geografik masofa muammosi tasdiqlanadi.");
    } else if (avg > 80) {
        console.log("🟡 O'rtacha kechikish — sezilarli, lekin kritik emas.");
    } else {
        console.log("🟢 Yaxshi kechikish — masofa muammo emas, boshqa sabab qidirish kerak.");
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error("❌ Xatolik:", err.message);
    process.exit(1);
});