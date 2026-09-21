// pages/login.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import Head from 'next/head';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // null = belum terdeteksi, true = mode ringan (HP/perangkat lemah), false = mode penuh (desktop)
  const [liteMode, setLiteMode] = useState(null);
  const canvasRef = useRef(null);
  const router = useRouter();

  // ========== DETEKSI PERANGKAT ==========
  // Di HP animasi latar (canvas + blur besar) membuat halaman berat/tersendat.
  // Karena itu perangkat berikut otomatis memakai mode ringan (latar CSS statis):
  // layar sempit, perangkat sentuh, CPU/RAM kecil, hemat data, atau pengguna
  // yang memilih "kurangi gerakan" (prefers-reduced-motion).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mqlReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqlNarrow = window.matchMedia && window.matchMedia('(max-width: 900px)');
    const mqlCoarse = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)');

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    const evaluate = () => {
      const lite =
        !!mqlReducedMotion?.matches ||
        !!mqlNarrow?.matches ||
        !!mqlCoarse?.matches ||
        cores <= 4 ||
        memory <= 4 ||
        connection?.saveData === true;
      setLiteMode(lite);
    };

    const listen = (mql, handler) => {
      if (!mql) return;
      if (mql.addEventListener) mql.addEventListener('change', handler);
      else if (mql.addListener) mql.addListener(handler); // Safari/WebView lama
    };
    const unlisten = (mql, handler) => {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else if (mql.removeListener) mql.removeListener(handler);
    };

    evaluate();
    [mqlReducedMotion, mqlNarrow, mqlCoarse].forEach((mql) => listen(mql, evaluate));
    return () => [mqlReducedMotion, mqlNarrow, mqlCoarse].forEach((mql) => unlisten(mql, evaluate));
  }, []);

  useEffect(() => {
    // Jika diarahkan ke sini karena sesi kedaluwarsa (token invalid/expired)
    if (router.query.error === 'session_expired') {
      setError('Sesi Anda telah berakhir karena token kedaluwarsa. Silakan masuk kembali menggunakan SSO.');
    }
  }, [router.query.error]);

  useEffect(() => {
    // Animasi partikel hanya dijalankan pada mode penuh (desktop).
    // Mode ringan memakai latar CSS statis -> tanpa loop render tiap frame.
    if (liteMode !== false) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const MAX_PARTICLES = 70;
    const CONNECT_DIST = 120;
    const FRAME_INTERVAL = 1000 / 30; // batasi ~30 fps (cukup halus, jauh lebih ringan)

    let particles = [];
    let backgroundCache = null;
    let animationFrameId = null;
    let resizeTimer = null;
    let lastFrameTime = 0;

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
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Latar (gradient + grid) digambar SEKALI ke canvas terpisah lalu ditempel
    // tiap frame. Sebelumnya gradient + ratusan garis grid digambar ulang terus.
    function buildBackground() {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const offCtx = off.getContext('2d');

      const gradient = offCtx.createLinearGradient(0, 0, off.width, off.height);
      gradient.addColorStop(0, '#0b1f1c');
      gradient.addColorStop(0.3, '#1a4731');
      gradient.addColorStop(0.6, '#115e59');
      gradient.addColorStop(1, '#0b3b2f');
      offCtx.fillStyle = gradient;
      offCtx.fillRect(0, 0, off.width, off.height);

      offCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      offCtx.lineWidth = 0.5;
      const gridSize = 40;
      offCtx.beginPath();
      for (let i = 0; i < off.width; i += gridSize) {
        offCtx.moveTo(i + 0.5, 0);
        offCtx.lineTo(i + 0.5, off.height);
      }
      for (let j = 0; j < off.height; j += gridSize) {
        offCtx.moveTo(0, j + 0.5);
        offCtx.lineTo(off.width, j + 0.5);
      }
      offCtx.stroke();

      backgroundCache = off;
    }

    function createParticles() {
      particles = [];
      const particleCount = Math.min(MAX_PARTICLES, Math.floor((canvas.width * canvas.height) / 22000));
      const colors = [
        'rgba(16, 185, 129, 0.6)',
        'rgba(5, 150, 105, 0.6)',
        'rgba(6, 182, 212, 0.6)',
        'rgba(59, 130, 246, 0.6)',
        'rgba(139, 92, 246, 0.6)',
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

    // Garis penghubung dikelompokkan ke 3 kelompok warna: cukup 3x stroke per
    // frame. Sebelumnya satu linear-gradient dibuat untuk SETIAP pasangan
    // (>4000 pasangan) setiap frame -> penyebab utama halaman berat.
    const buckets = [
      { max: 62, color: 'rgba(16, 185, 129, 0.16)', points: [] },
      { max: 92, color: 'rgba(6, 182, 212, 0.11)', points: [] },
      { max: CONNECT_DIST, color: 'rgba(59, 130, 246, 0.07)', points: [] },
    ];

    function drawConnections() {
      buckets.forEach((bucket) => {
        bucket.points.length = 0;
      });

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance >= CONNECT_DIST) continue;

          const bucket = distance < buckets[0].max ? buckets[0] : distance < buckets[1].max ? buckets[1] : buckets[2];
          bucket.points.push(a, b);
        }
      }

      buckets.forEach((bucket) => {
        if (bucket.points.length === 0) return;
        ctx.strokeStyle = bucket.color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < bucket.points.length; i += 2) {
          ctx.moveTo(bucket.points[i].x, bucket.points[i].y);
          ctx.lineTo(bucket.points[i + 1].x, bucket.points[i + 1].y);
        }
        ctx.stroke();
      });
    }

    function renderFrame() {
      if (backgroundCache) {
        ctx.drawImage(backgroundCache, 0, 0);
      } else {
        ctx.fillStyle = '#0b1f1c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      drawConnections();
    }

    function animate(timestamp) {
      animationFrameId = requestAnimationFrame(animate);
      if (timestamp - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = timestamp;
      renderFrame();
    }

    function startAnimation() {
      if (animationFrameId !== null) return;
      lastFrameTime = 0;
      animationFrameId = requestAnimationFrame(animate);
    }

    function stopAnimation() {
      if (animationFrameId === null) return;
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildBackground();
      createParticles();
    }

    function handleResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCanvas, 200);
    }

    function handleVisibilityChange() {
      // Hemat baterai: hentikan animasi saat tab tidak aktif.
      if (document.hidden) stopAnimation();
      else startAnimation();
    }

    resizeCanvas();
    startAnimation();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopAnimation();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [liteMode]);

  const handleSSOLogin = async () => {
    setIsLoading(true);
    try {
      await signIn('keycloak', { callbackUrl: '/' });
    } catch (err) {
      setError('Gagal terhubung ke server SSO');
      setIsLoading(false);
    }
  };

  const features = [
    {
      title: 'Manajemen Aset',
      description: 'Pendataan dan monitoring seluruh aset negara secara digital',
      icon: '🏗️',
    },
    {
      title: 'Laporan Kerusakan',
      description: 'Pelaporan dan penanganan kerusakan aset secara terintegrasi',
      icon: '🔧',
    },
    {
      title: 'Verifikasi & Disposisi',
      description: 'Alur verifikasi PIC, Kabag TU, dan PPK yang terstruktur',
      icon: '✓',
    },
    {
      title: 'Monitoring Perbaikan',
      description: 'Tracking status perbaikan hingga selesai',
      icon: '📈',
    },
  ];

  const fullMode = liteMode === false;

  return (
    <>
      <Head>
        <title>Login | TABELA RAYA - BBPOM Palangka Raya</title>
        <meta name="description" content="Sistem Tata Kelola Barang Negara BBPOM di Palangka Raya" />
      </Head>

      {/* Latar dasar statis: tampil di semua perangkat, dan sekaligus menjadi
          pengganti canvas di mode ringan (tanpa animasi & tanpa blur besar). */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 0,
          background: 'linear-gradient(135deg, #0b1f1c 0%, #1a4731 30%, #115e59 60%, #0b3b2f 100%)',
        }}
      />
      <div
        className="fixed inset-0"
        style={{
          zIndex: 0,
          background:
            'radial-gradient(900px 620px at 15% 18%, rgba(16, 185, 129, 0.18), rgba(16, 185, 129, 0) 70%), radial-gradient(900px 700px at 85% 82%, rgba(6, 182, 212, 0.16), rgba(6, 182, 212, 0) 70%)',
        }}
      />
      <div
        className="fixed inset-0"
        style={{
          zIndex: 0,
          backgroundImage:
            'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.02) 0 1px, rgba(255, 255, 255, 0) 1px 40px), repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 0 1px, rgba(255, 255, 255, 0) 1px 40px)',
        }}
      />

      {/* Animated Background Canvas - hanya mode penuh */}
      {fullMode && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-full h-full"
          style={{ zIndex: 0 }}
        />
      )}

      {/* Floating Geometric Elements - hanya mode penuh */}
      {fullMode && (
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
      )}

      {/* Animated Gradient Orbs - hanya mode penuh (blur besar sangat mahal di HP) */}
      {fullMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
          <div className="absolute top-20 left-20 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-20 right-20 w-[700px] h-[700px] bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-full blur-[150px] animate-pulse-slower" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-cyan-600/10 rounded-full blur-[180px] animate-spin-very-slow" />
        </div>
      )}

      {/* Floating Icons - hanya mode penuh */}
      {fullMode && (
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
      )}

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4" style={{ zIndex: 10 }}>
        {/* Glassmorphism Container */}
        <div
          className={`w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 ${
            fullMode ? 'backdrop-blur-xl bg-white/10' : 'bg-white/10'
          }`}
        >
          <div className="grid md:grid-cols-2">
            {/* LEFT COLUMN - Description/Branding */}
            <div
              className={`bg-gradient-to-br from-emerald-900/90 to-teal-900/90 p-10 text-white relative overflow-hidden ${
                fullMode ? 'backdrop-blur-sm' : ''
              }`}
            >
              {/* Decorative Elements */}
              <div className={`absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 ${fullMode ? 'animate-blob' : ''}`}></div>
              <div className={`absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 ${fullMode ? 'animate-blob animation-delay-2000' : ''}`}></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 h-full flex flex-col">
                {/* Logo and Title with Animation */}
                <div className="mb-8 animate-fade-in-up">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300 ${fullMode ? 'animate-pulse-glow' : ''}`}>
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

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all duration-300 group animate-fade-in-up"
                      style={{ animationDelay: `${600 + idx * 100}ms` }}
                    >
                      <div className="text-3xl mb-2">{feature.icon}</div>
                      <h3 className="font-semibold text-base text-emerald-200 group-hover:text-white transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-emerald-300/70 text-xs mt-1">{feature.description}</p>
                    </div>
                  ))}
                </div>

                {/* Footer with Animation */}
                <div className="animate-fade-in animation-delay-1000 mt-auto">
                  <div className="flex items-center space-x-2 text-sm text-emerald-200/80">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <p>Balai Besar POM di Palangka Raya</p>
                  </div>
                  <p className="text-xs text-emerald-200/60 mt-2">© 2026 - Sistem Terpadu BMN v1.0</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - Login Form with Additional Info */}
            <div className={`p-10 flex items-center ${fullMode ? 'bg-white/95 backdrop-blur-xl' : 'bg-white'}`}>
              <div className="w-full max-w-md mx-auto">
                {/* Welcome Text */}
                <div className="text-center mb-8 animate-fade-in-down">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Selamat Datang
                  </h2>
                  <p className="text-gray-500 mt-2">Silakan masuk menggunakan akun SSO Anda</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm animate-shake">
                    {error}
                  </div>
                )}

                {/* SSO Button */}
                <button
                  onClick={handleSSOLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 px-4 rounded-xl flex items-center justify-center space-x-3 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 relative overflow-hidden group animate-fade-in-up animation-delay-100"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  {isLoading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm6 13h-5v5h-2v-5h-5v-2h5v-5h2v5h5v2z" />
                      </svg>
                      <span>Login dengan SSO BBPOM</span>
                    </>
                  )}
                </button>

                {/* Informasi Sistem */}
                <div className="mt-8 pt-6 border-t border-gray-200 animate-fade-in-up animation-delay-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">
                    Informasi Sistem
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Status Sistem</span>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-green-600 font-medium">Aktif</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Versi Terbaru</span>
                      <span className="text-gray-700 font-medium">v1.0.0</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Terakhir Update</span>
                      <span className="text-gray-700">Januari 2026</span>
                    </div>
                  </div>
                </div>

                {/* Informasi Kontak */}
                <div className="mt-6 text-center animate-fade-in animation-delay-300">
                  <p className="text-xs text-gray-400">
                    Butuh bantuan? Hubungi admin di <br />
                    <a href="mailto:suciana.istighfarah@pom.go.id" className="text-emerald-600 hover:underline">
                      Suciana Istigfarah
                    </a>
                  </p>
                </div>

                {/* Version */}
                <p className="text-center text-xs text-gray-400 mt-6 animate-fade-in animation-delay-400">
                  © 2026 BBPOM Palangka Raya. All rights reserved.
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
        .animation-delay-1400 {
          animation-delay: 1400ms;
        }
        .animation-delay-2000 {
          animation-delay: 2000ms;
        }

        /* Hormati preferensi sistem: matikan animasi berulang, dan pastikan
           elemen yang memakai animasi masuk tetap terlihat (opacity akhir). */
        @media (prefers-reduced-motion: reduce) {
          .animate-float,
          .animate-float-reverse,
          .animate-blob,
          .animate-pulse-slow,
          .animate-pulse-slower,
          .animate-spin-very-slow,
          .animate-pulse-glow {
            animation: none !important;
          }

          .animate-fade-in-up,
          .animate-fade-in-down,
          .animate-fade-in,
          .animate-slide-in,
          .animate-expand-width {
            animation-duration: 0.01ms !important;
            animation-delay: 0ms !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </>
  );
}
