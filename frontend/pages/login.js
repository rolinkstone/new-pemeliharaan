// pages/login.js
import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Head from 'next/head';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Animated Background Particles
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [];
    let animationFrameId;

    class Particle {
      constructor(x, y, size, speedX, speedY, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speedX = speedX;
        this.speedY = speedY;
        this.color = color;
        this.alpha = 0.3 + Math.random() * 0.7;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
        if (this.y > canvas.height || this.y < 0) this.speedY *= -1;

        this.alpha = 0.3 + 0.4 * Math.sin(Date.now() * 0.001 + this.x * 0.01);
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function createParticles() {
      particles = [];
      const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
      const colors = [
        'rgba(16, 185, 129, 0.6)', // emerald
        'rgba(5, 150, 105, 0.6)',  // emerald dark
        'rgba(6, 182, 212, 0.6)',  // cyan
        'rgba(59, 130, 246, 0.6)', // blue
        'rgba(139, 92, 246, 0.6)', // purple
      ];

      for (let i = 0; i < particleCount; i++) {
        const size = Math.random() * 4 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const speedX = (Math.random() - 0.5) * 0.3;
        const speedY = (Math.random() - 0.5) * 0.3;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, size, speedX, speedY, color));
      }
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            const gradient = ctx.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            gradient.addColorStop(0, `rgba(16, 185, 129, ${0.15 * (1 - distance / 120)})`);
            gradient.addColorStop(1, `rgba(6, 182, 212, ${0.15 * (1 - distance / 120)})`);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.8;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0b1f1c');
      gradient.addColorStop(0.3, '#1a4731');
      gradient.addColorStop(0.6, '#115e59');
      gradient.addColorStop(1, '#0b3b2f');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let i = 0; i < canvas.width; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      drawConnections();
      animationFrameId = requestAnimationFrame(animate);
    }

    function handleResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      createParticles();
    }

    createParticles();
    animate();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSSOLogin = async () => {
    setIsLoading(true);
    try {
      await signIn('keycloak', { callbackUrl: '/' });
    } catch (err) {
      setError('Gagal terhubung ke server SSO');
      setIsLoading(false);
    }
  };

  const handleManualLogin = (e) => {
    e.preventDefault();
    // Implementasi manual login jika diperlukan
    console.log('Manual login');
  };

  return (
    <>
      <Head>
        <title>Login | TABELA RAYA - BBPOM Palangka Raya</title>
        <meta name="description" content="Sistem Tata Kelola Barang Negara BBPOM di Palangka Raya" />
      </Head>
      
      {/* Animated Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />

      {/* Floating Geometric Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute border border-white/10 rounded-3xl"
            style={{
              width: `${150 + i * 80}px`,
              height: `${150 + i * 80}px`,
              top: `${5 + i * 12}%`,
              left: `${2 + i * 8}%`,
              animation: `float ${10 + i * 3}s ease-in-out infinite ${i * 0.7}s`,
              transform: `rotate(${i * 25}deg)`,
              background: `linear-gradient(135deg, rgba(16, 185, 129, ${0.02 + i * 0.01}), rgba(6, 182, 212, ${0.02 + i * 0.01}))`,
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
              backdropFilter: 'blur(4px)',
            }}
          />
        ))}
      </div>

      {/* Animated Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
        <div className="absolute top-20 left-20 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-[700px] h-[700px] bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-full blur-[150px] animate-pulse-slower" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10 rounded-full blur-[180px] animate-spin-very-slow" />
      </div>

      {/* Floating Icons */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={`icon-${i}`}
            className="absolute text-white/5"
            style={{
              top: `${15 + i * 20}%`,
              right: `${5 + i * 10}%`,
              animation: `float-reverse ${12 + i * 4}s ease-in-out infinite ${i * 2}s`,
              fontSize: `${40 + i * 20}px`,
              transform: `rotate(${i * 30}deg)`,
            }}
          >
            {i % 3 === 0 && '📦'}
            {i % 3 === 1 && '🏢'}
            {i % 3 === 2 && '📊'}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4" style={{ zIndex: 10 }}>
        {/* Glassmorphism Container */}
        <div className="w-full max-w-6xl backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          <div className="grid md:grid-cols-2">
            {/* LEFT COLUMN - Description/Branding */}
            <div className="bg-gradient-to-br from-emerald-900/90 to-teal-900/90 backdrop-blur-sm p-10 text-white relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 animate-blob"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 animate-blob animation-delay-2000"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 h-full flex flex-col">
                {/* Logo and Title with Animation */}
                <div className="mb-8 animate-fade-in-up">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300 animate-pulse-glow">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent animate-slide-in">
                        Tabela Raya
                      </h1>
                      <div className="h-1 w-20 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full mt-2 animate-expand-width"></div>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-semibold mb-2 text-emerald-100 animate-fade-in animation-delay-300">
                    Tata Kelola Barang Negara
                  </h2>
                  <p className="text-emerald-100/90 text-lg leading-relaxed animate-fade-in animation-delay-500">
                    Sistem terpadu pengelolaan aset dan persediaan BBPOM Palangka Raya
                  </p>
                </div>

                {/* Features with Staggered Animation */}
                <div className="space-y-6 mb-8">
                  {[
                    {
                      icon: (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      ),
                      title: "Inventarisasi Real-time",
                      desc: "Pendataan aset secara digital dan akurat",
                      delay: 100
                    },
                    {
                      icon: (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      ),
                      title: "Monitoring Pemeliharaan",
                      desc: "Jadwal dan riwayat perawatan aset",
                      delay: 200
                    },
                    {
                      icon: (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      ),
                      title: "Pelaporan Terintegrasi",
                      desc: "Laporan BMN sesuai standar akuntansi",
                      delay: 300
                    }
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-4 group transform hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${feature.delay}ms` }}
                    >
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur border border-white/20 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                        <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {feature.icon}
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-emerald-300 transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-emerald-100/80 text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats with Glow Effect */}
                <div className="grid grid-cols-2 gap-4 mt-auto mb-6">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:border-emerald-400/50 group animate-fade-in-up animation-delay-600">
                    <div className="text-3xl font-bold text-white group-hover:text-emerald-300 transition-colors">500+</div>
                    <div className="text-emerald-200 text-sm flex items-center">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                      Aset Tercatat
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:border-emerald-400/50 group animate-fade-in-up animation-delay-700">
                    <div className="text-3xl font-bold text-white group-hover:text-emerald-300 transition-colors">100%</div>
                    <div className="text-emerald-200 text-sm flex items-center">
                      <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                      Terintegrasi SSO
                    </div>
                  </div>
                </div>

                {/* Footer with Animation */}
                <div className="animate-fade-in animation-delay-800">
                  <div className="flex items-center space-x-2 text-sm text-emerald-200/80">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <p>Balai Besar POM di Palangka Raya</p>
                  </div>
                  <p className="text-xs text-emerald-200/60 mt-2">© 2024 - Sistem Terpadu BMN v1.0</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Login Form */}
            <div className="p-10 bg-white/95 backdrop-blur-xl flex items-center">
              <div className="w-full max-w-md mx-auto">
                {/* Welcome Text with Animation */}
                <div className="text-center mb-8 animate-fade-in-down">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Selamat Datang Kembali
                  </h2>
                  <p className="text-gray-500 mt-2">Silakan masuk ke akun Anda</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm animate-shake">
                    {error}
                  </div>
                )}

                {/* SSO Button with Animation */}
                <button
                  onClick={handleSSOLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 px-4 rounded-xl flex items-center justify-center space-x-3 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] mb-6 disabled:opacity-50 relative overflow-hidden group animate-fade-in-up animation-delay-100"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  {isLoading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 animate-bounce-slow" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm6 13h-5v5h-2v-5h-5v-2h5v-5h2v5h5v2z" />
                      </svg>
                      <span>Login dengan SSO BBPOM</span>
                    </>
                  )}
                </button>

                {/* Divider with Animation */}
                <div className="relative my-8 animate-fade-in animation-delay-200">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">atau masuk dengan</span>
                  </div>
                </div>

                {/* Manual Login Form */}
                <form onSubmit={handleManualLogin} className="space-y-5">
                  <div className="animate-fade-in-up animation-delay-300">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NIP / Username
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all hover:border-emerald-300"
                      placeholder="Masukkan NIP"
                    />
                  </div>

                  <div className="animate-fade-in-up animation-delay-400">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all hover:border-emerald-300"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="flex items-center justify-between animate-fade-in-up animation-delay-500">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="ml-2 text-sm text-gray-600 group-hover:text-emerald-600 transition-colors">
                        Ingat saya
                      </span>
                    </label>
                    <button 
                      type="button" 
                      className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline transition-all hover:scale-105"
                    >
                      Lupa password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-white text-emerald-600 border-2 border-emerald-600 font-semibold py-3 px-4 rounded-xl hover:bg-emerald-50 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-fade-in-up animation-delay-600 relative overflow-hidden group"
                  >
                    <span className="relative z-10">Masuk</span>
                    <div className="absolute inset-0 bg-emerald-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  </button>
                </form>

                {/* App Downloads */}
                <div className="mt-8 flex justify-center space-x-4 animate-fade-in-up animation-delay-700">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs hover:bg-gray-800 hover:scale-105 transition-all duration-300 cursor-pointer group">
                    <svg className="w-4 h-4 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.79 0 2.26-1.07 3.82-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span>Download di App Store</span>
                  </div>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs hover:bg-gray-800 hover:scale-105 transition-all duration-300 cursor-pointer group">
                    <svg className="w-4 h-4 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                    </svg>
                    <span>GET IT ON Google Play</span>
                  </div>
                </div>

                {/* Version */}
                <p className="text-center text-xs text-gray-400 mt-6 animate-fade-in animation-delay-800">
                  © 2024 BBPOM Palangka Raya. Versi 1.0
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--tw-rotate)); }
          50% { transform: translateY(-30px) rotate(var(--tw-rotate)); }
        }

        @keyframes float-reverse {
          0%, 100% { transform: translateY(0) rotate(var(--tw-rotate)); }
          50% { transform: translateY(30px) rotate(var(--tw-rotate)); }
        }

        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 20px) scale(0.9); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }

        @keyframes pulse-slower {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.2); }
        }

        @keyframes spin-very-slow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-in {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes expand-width {
          from { width: 0; }
          to { width: 80px; }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.6); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-float-reverse {
          animation: float-reverse 10s ease-in-out infinite;
        }

        .animate-blob {
          animation: blob 15s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }

        .animate-pulse-slower {
          animation: pulse-slower 12s ease-in-out infinite;
        }

        .animate-spin-very-slow {
          animation: spin-very-slow 30s linear infinite;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-fade-in-down {
          animation: fade-in-down 0.8s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        .animate-slide-in {
          animation: slide-in 0.8s ease-out forwards;
        }

        .animate-expand-width {
          animation: expand-width 1s ease-out forwards;
        }

        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animation-delay-100 {
          animation-delay: 100ms;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-300 {
          animation-delay: 300ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
        .animation-delay-500 {
          animation-delay: 500ms;
        }
        .animation-delay-600 {
          animation-delay: 600ms;
        }
        .animation-delay-700 {
          animation-delay: 700ms;
        }
        .animation-delay-800 {
          animation-delay: 800ms;
        }
        .animation-delay-900 {
          animation-delay: 900ms;
        }
        .animation-delay-1000 {
          animation-delay: 1000ms;
        }
        .animation-delay-2000 {
          animation-delay: 2000ms;
        }
      `}</style>
    </>
  );
}