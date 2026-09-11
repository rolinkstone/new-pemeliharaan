export default function handler(req, res) {
  // Set multiple cookies dengan berbagai konfigurasi
  res.setHeader('Set-Cookie', [
    'test-cookie-1=value1; Path=/; HttpOnly; SameSite=Lax',
    'test-cookie-2=value2; Path=/; SameSite=Lax',
    'next-auth-test-cookie=test-session; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
  ]);
  
  res.status(200).json({ 
    success: true,
    message: 'Cookies set via API',
    requestCookies: req.headers.cookie || 'No cookies in request'
  });
}