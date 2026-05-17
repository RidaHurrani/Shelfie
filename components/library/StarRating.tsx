"use client"
import { useState } from "react"
import { Star } from "lucide-react"

interface StarRatingProps {
  value: number | null
  onChange?: (rating: number) => void
  readOnly?: boolean
  size?: number
}

export default function StarRating({ value, onChange, readOnly = false, size = 20 }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const display = hovered ?? value ?? 0

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(null)}
          className={readOnly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"}
        >
          <Star
            width={size}
            height={size}
            className={
              star <= display
                ? "fill-[#D4A55A] text-[#D4A55A]"
                : "fill-transparent text-[#4A2C14]"
            }
          />
        </button>
      ))}
    </div>
  )
}
