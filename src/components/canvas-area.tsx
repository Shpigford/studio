import { forwardRef } from "react"

const CanvasArea = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-1 items-center justify-center bg-canvas order-1 md:order-none overflow-hidden [&_canvas]:!max-w-full [&_canvas]:!max-h-full [&_canvas]:!w-auto [&_canvas]:!h-auto ${className ?? ''}`}
      {...props}
    >
      {children}
    </div>
  )
)
CanvasArea.displayName = "CanvasArea"

export { CanvasArea }
