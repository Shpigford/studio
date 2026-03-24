import { useId } from "react"
import { Switch } from "@/components/ui/switch"

interface SwitchControlProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SwitchControl({
  label,
  checked,
  onChange,
}: SwitchControlProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-xs text-text-secondary">{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
