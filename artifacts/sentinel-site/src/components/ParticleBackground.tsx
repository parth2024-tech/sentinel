export default function ParticleBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Precision Technical Blueprint Grid (Zero CPU Overhead) */}
      <div 
        className="absolute inset-0 opacity-[0.04]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, #22d3ee 1px, transparent 1px), linear-gradient(to bottom, #22d3ee 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }} 
      />
      {/* Radial Depth Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.05)_0%,rgba(10,14,24,0)_70%)]" />
    </div>
  );
}
