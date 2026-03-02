import { Construction } from 'lucide-react'

interface SettingsPlaceholderProps {
  label: string
  description: string
}

export function SettingsPlaceholder({ label, description }: SettingsPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
        <Construction className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">{label}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      <p className="mt-3 text-xs text-gray-400">Phase B에서 구현 예정</p>
    </div>
  )
}
