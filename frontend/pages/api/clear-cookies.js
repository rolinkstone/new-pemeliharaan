// pages/api/clear-cookies.js
export default function handler(req, res) {
  // Set semua cookie NextAuth ke expired
  const cookies = [
    'next-auth.session-token',
    'next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.callback-url',
    '__Host-next-auth.csrf-token'
  ];
  
  const clearCookies = cookies.map(cookie => {
    return `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`;
  }).join(', ');
  
  res.setHeader('Set-Cookie', clearCookies);
  res.status(200).json({ 
    message: 'Cookies cleared successfully',
    redirectTo: '/login' 
  });
}