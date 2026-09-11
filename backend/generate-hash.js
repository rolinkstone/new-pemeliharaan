const bcrypt = require("bcrypt");

// Pemakaian: node generate-hash.js "<password-baru>"
// (atau set env HASH_PASSWORD) - jangan tulis password di dalam file ini.
(async () => {
  const password = process.argv[2] || process.env.HASH_PASSWORD;

  if (!password) {
    console.error('Usage: node generate-hash.js "<password-baru>"');
    console.error('   atau: set HASH_PASSWORD=<password-baru> lalu jalankan script ini');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
})();
