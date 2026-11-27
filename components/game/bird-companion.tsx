'use client'

import { Sparkles } from 'lucide-react'

export type BirdMood = 'idle' | 'happy' | 'cheer' | 'worry'

type BirdCompanionProps = {
  mood: BirdMood
  message: string
}

export function BirdCompanion({ mood, message }: BirdCompanionProps) {
  return (
    <div className={`bird-companion bird-companion-${mood}`} aria-live="polite">
      <div className="bird-companion-avatar" aria-hidden="true">
        <svg viewBox="0 0 64 64" className="bird-companion-svg">
          <defs>
            <linearGradient id="companion-body-grad" x1="20%" y1="10%" x2="85%" y2="90%">
              <stop offset="0%" stopColor="#ffe58c" />
              <stop offset="55%" stopColor="#f0b643" />
              <stop offset="100%" stopColor="#d4882a" />
            </linearGradient>
            <linearGradient id="companion-wing-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5c961" />
              <stop offset="100%" stopColor="#be6f1f" />
            </linearGradient>
          </defs>

          {/* Soft perch shadow */}
          <ellipse cx="32" cy="56" rx="15" ry="3.5" fill="rgba(45, 58, 34, 0.14)" />

          {/* Tail feathers */}
          <path
            d="M 16 39 L 5 33 L 10 42 L 6 47 L 18 45 Z"
            fill="#c97d26"
            stroke="#5a3712"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Feet */}
          <path
            d="M 27 49 L 27 54 M 24 54 L 30 54 M 37 49 L 37 54 M 34 54 L 40 54"
            stroke="#8a5520"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Main round bird body + head tilt group */}
          <g className="bird-head-tilt">
            {/* Crest tuft */}
            <path
              d="M 30 14 Q 28 7 34 9 Q 37 5 39 12"
              fill="#f2ba49"
              stroke="#5a3712"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Plump round body */}
            <ellipse
              cx="33"
              cy="34"
              rx="18"
              ry="17"
              fill="url(#companion-body-grad)"
              stroke="#5a3712"
              strokeWidth="2.2"
            />

            {/* Cream breast */}
            <ellipse cx="38" cy="39" rx="10.5" ry="9.5" fill="#fff6da" opacity="0.92" />

            {/* Expressive eye */}
            {mood === 'cheer' || mood === 'happy' ? (
              <path
                d="M 36 27 Q 40 23 44 27"
                fill="none"
                stroke="#35200b"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            ) : (
              <g className="bird-eye-blink">
                <circle cx="40" cy="27" r="4.2" fill="#fffdf6" stroke="#35200b" strokeWidth="1.4" />
                <circle cx="41" cy="27" r="2.2" fill="#2c1a09" />
                <circle cx="41.8" cy="26" r="0.8" fill="#ffffff" />
                {mood === 'worry' && (
                  <path d="M 35 21 L 43 23" stroke="#5a3712" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </g>
            )}

            {/* Rosy cheek */}
            <circle cx="35" cy="33" r="3" fill="#eb7a62" opacity="0.52" />

            {/* Beak */}
            <path
              d={
                mood === 'cheer'
                  ? 'M 48 28 L 57 26 L 51 33 Z M 48 31 L 56 34 L 49 34 Z'
                  : 'M 48 29 L 57 31.5 L 48 34.5 Z'
              }
              fill="#e9793a"
              stroke="#5a3712"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Fluttering wing */}
            <path
              className="bird-wing-flutter"
              d="M 19 32 Q 16 44 30 43 Q 36 39 30 30 Q 24 27 19 32 Z"
              fill="url(#companion-wing-grad)"
              stroke="#5a3712"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
      <div className="bird-companion-bubble">
        <span className="bird-companion-kicker">
          <Sparkles aria-hidden="true" /> Pip the Robin
        </span>
        <p>{message}</p>
      </div>
    </div>
  )
}
