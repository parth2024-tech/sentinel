import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { Battery, HardDrive, Cpu, Activity } from "lucide-react";

export default function HeroIllustration() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized mouse position (-1 to 1) relative to center of screen
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      
      animate(mouseX, x, { duration: 0.5, ease: "easeOut" });
      animate(mouseY, y, { duration: 0.5, ease: "easeOut" });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Parallax transforms based on mouse position
  const rotateX = useTransform(mouseY, [-1, 1], [15, -15]);
  const rotateY = useTransform(mouseX, [-1, 1], [-15, 15]);
  
  const layer1X = useTransform(mouseX, [-1, 1], [-20, 20]);
  const layer1Y = useTransform(mouseY, [-1, 1], [-20, 20]);
  
  const layer2X = useTransform(mouseX, [-1, 1], [-40, 40]);
  const layer2Y = useTransform(mouseY, [-1, 1], [-40, 40]);
  
  const layer3X = useTransform(mouseX, [-1, 1], [-60, 60]);
  const layer3Y = useTransform(mouseY, [-1, 1], [-60, 60]);

  return (
    <div 
      style={{ perspective: 1000 }}
      className="relative w-full max-w-3xl aspect-square mx-auto flex items-center justify-center pointer-events-none"
    >
      
      {/* Central Core */}
      <motion.div 
        style={{ transformStyle: 'preserve-3d', rotateX, rotateY }}
        className="relative w-64 h-64 flex items-center justify-center pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Core Glow */}
        <motion.div 
          animate={{ 
            scale: isHovered ? 1.2 : 1,
            opacity: isHovered ? 0.8 : 0.4
          }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 bg-primary/30 rounded-full blur-[60px] animate-pulse-ring" 
        />
        
        {/* Outer Ring 1 */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-40px] border border-primary/20 rounded-full border-dashed"
        />

        {/* Outer Ring 2 */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-20px] border border-accent/30 rounded-full border-t-accent/60"
        />

        {/* Inner Core Ball */}
        <motion.div 
          className="relative w-32 h-32 rounded-full bg-background border border-border/80 flex items-center justify-center overflow-hidden shadow-[0_0_50px_-10px_rgba(34,211,238,0.4)] backdrop-blur-md"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
          <Activity className="w-12 h-12 text-primary animate-glow-pulse" />
          
          {/* Scanning line effect inside core */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent animate-scan-line" />
        </motion.div>
      </motion.div>

      {/* Floating Elements (Glassmorphic Cards) */}
      {/* Battery Card */}
      <motion.div 
        style={{ x: layer1X, y: layer1Y }}
        className="absolute top-[10%] right-[15%] w-48 p-4 rounded-xl border border-primary/40 bg-background/60 backdrop-blur-xl shadow-xl z-20 pointer-events-auto hover:border-primary transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-red-500/10 border border-red-500/20">
              <Battery className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Battery</span>
          </div>
          <span className="text-xs font-mono font-bold text-red-400">23%</span>
        </div>
        <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "23%" }}
            transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
            className="h-full bg-red-400 glow-red"
          />
        </div>
      </motion.div>

      {/* SSD Card */}
      <motion.div 
        style={{ x: layer2X, y: layer2Y }}
        className="absolute bottom-[20%] left-[10%] w-52 p-4 rounded-xl border border-amber-400/40 bg-background/60 backdrop-blur-xl shadow-xl z-20 pointer-events-auto hover:border-amber-400/80 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SSD Wear</span>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400">61%</span>
        </div>
        <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "61%" }}
            transition={{ delay: 0.7, duration: 1.5, ease: "easeOut" }}
            className="h-full bg-amber-400"
          />
        </div>
      </motion.div>

      {/* CPU Thermals Card */}
      <motion.div 
        style={{ x: layer3X, y: layer3Y }}
        className="absolute top-[25%] left-[5%] w-40 p-4 rounded-xl border border-border/60 bg-background/60 backdrop-blur-xl shadow-xl z-20 pointer-events-auto hover:border-primary/60 transition-colors"
      >
         <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thermal</span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-mono font-bold text-foreground">84</span>
            <span className="text-xs text-muted-foreground mb-1">°C</span>
          </div>
          {/* Mini line chart aesthetic */}
          <div className="flex items-end h-6 gap-1 mt-1 opacity-70">
            {[40, 60, 55, 70, 84, 82, 84].map((h, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
                className={`w-full rounded-t-sm ${h > 80 ? 'bg-red-400 glow-red' : 'bg-primary'}`}
              />
            ))}
          </div>
        </div>
      </motion.div>

    </div>
  );
}
