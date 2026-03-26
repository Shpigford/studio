export default function About() {
  return (
    <div className="flex flex-1 items-center justify-center bg-canvas order-1 md:order-none">
      <div className="max-w-md space-y-6 px-6 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Studio</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          A collection of generative art and design tools. Each tool produces
          unique visual outputs using algorithms, noise functions, and creative
          coding techniques.
        </p>
        <div className="space-y-3 text-left text-xs text-text-muted">
          <div className="flex justify-between border-b border-border-control pb-2">
            <span>Stack</span>
            <span className="text-text-primary">React + p5.js + Canvas 2D + WebGL2</span>
          </div>
          <div className="flex justify-between border-b border-border-control pb-2">
            <span>GitHub</span>
            <a href="https://github.com/Shpigford/studio" target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-white">Shpigford/studio</a>
          </div>
          <div className="flex justify-between border-b border-border-control pb-2">
            <span>X</span>
            <a href="https://x.com/Shpigford" target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-white">@Shpigford</a>
          </div>
        </div>
      </div>
    </div>
  )
}
