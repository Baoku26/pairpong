import { useState, useEffect, useRef } from "react";
const LoadingScreen = ({ onLoadingComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("INITIALIZING");
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Particle animation effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let particles = [];
    let frame = 0;

    // Create 50 particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
      });
    }

    const animate = () => {
      // Fade effect
      ctx.fillStyle = "rgba(42, 110, 64, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw and move particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw particle with pulsing opacity
        ctx.fillStyle = `rgba(168, 240, 162, ${
          0.3 + Math.sin(frame * 0.05) * 0.2
        })`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      frame++;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Progress bar effect
  useEffect(() => {
    const loadingSteps = [
      { percent: 20, text: "LOADING BLOCKCHAIN..." },
      { percent: 40, text: "FETCHING PRICES..." },
      { percent: 60, text: "PREPARING BATTLE..." },
      { percent: 80, text: "READY..." },
      { percent: 100, text: "LAUNCH!" },
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length) {
        setProgress(loadingSteps[currentStep].percent);
        setLoadingText(loadingSteps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        // Wait 500ms after completion, then call the complete function
        setTimeout(() => onLoadingComplete(), 500);
      }
    }, 600); // Each step takes 600ms

    return () => clearInterval(interval);
  }, [onLoadingComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2E1F] flex flex-col items-center justify-center">
      {/* Background particle canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute inset-0 w-full h-full opacity-30"
      />

      {/* Content */}
      <div className="relative z-10 text-center space-y-8">
        {/* Logo */}
        <div className="animate-pulse">
          <Swords
            size={80}
            className="text-[#3BA76F] mx-auto mb-6"
            strokeWidth={1.5}
          />
        </div>

        {/* Title */}
        <h1
          className="heading-font text-4xl md:text-6xl text-[#A8F0A2] tracking-wider"
          style={{ animation: "fadeIn 1s ease-out" }}
        >
          CRYPTO PONG
          <br />
          <span className="text-[#F5C542]">BATTLE</span>
        </h1>

        {/* Progress section */}
        <div className="w-80 max-w-md mx-auto space-y-3">
          {/* Loading text */}
          <div className="text-[#9EB39F] text-xs tracking-widest animate-pulse">
            {loadingText}
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-[#26462F] border-2 border-[#3BA76F] rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#3BA76F] to-[#A8F0A2] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div
                className="absolute inset-0 bg-white/20"
                style={{ animation: "shimmer 2s infinite" }}
              ></div>
            </div>
          </div>

          {/* Percentage */}
          <div className="text-[#A8F0A2] text-xl font-bold">{progress}%</div>
        </div>

        {/* Bottom text with glitch effect */}
        <div
          className="text-[#9EB39F] text-xs tracking-wider"
          style={{ animation: "glitch 3s infinite" }}
        >
          {">>> CONNECTING TO BLOCKCHAIN <<<"}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn { 
          from { opacity: 0; transform: translateY(-20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes shimmer { 
          0% { transform: translateX(-100%); } 
          100% { transform: translateX(100%); } 
        }
        @keyframes glitch { 
          0%, 100% { opacity: 1; transform: translateX(0); } 
          20% { opacity: 0.8; transform: translateX(-2px); } 
          40% { opacity: 1; transform: translateX(2px); } 
          60% { opacity: 0.8; transform: translateX(-2px); } 
          80% { opacity: 1; transform: translateX(0); } 
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
