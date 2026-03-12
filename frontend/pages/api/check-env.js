// pages/api/check-env.js
export default function handler(req, res) {
  console.log("=== ENVIRONMENT CHECK ===")
  
  const envVars = {
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER ? "✅ SET" : "❌ MISSING",
    KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID ? "✅ SET" : "❌ MISSING", 
    KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET ? "✅ SET (length: " + process.env.KEYCLOAK_CLIENT_SECRET.length + ")" : "❌ MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "❌ NOT SET",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "✅ SET (length: " + process.env.NEXTAUTH_SECRET.length + ")" : "❌ MISSING",
    NODE_ENV: process.env.NODE_ENV || "development",
  }
  
  console.log(envVars)
  
  // Jangan tampilkan secret di response
  const safeResponse = {
    ...envVars,
    KEYCLOAK_CLIENT_SECRET: envVars.KEYCLOAK_CLIENT_SECRET.includes("✅") ? "✅ SET (hidden)" : "❌ MISSING",
    NEXTAUTH_SECRET: envVars.NEXTAUTH_SECRET.includes("✅") ? "✅ SET (hidden)" : "❌ MISSING",
  }
  
  res.status(200).json(safeResponse)
}