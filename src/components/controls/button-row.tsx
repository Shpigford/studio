interface ButtonRowProps {
  children: React.ReactNode
}

export function ButtonRow({ children }: ButtonRowProps) {
  return (
    <div className="flex flex-col gap-1">
      {children}
    </div>
  )
}
