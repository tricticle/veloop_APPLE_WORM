export type SoundName =
  | 'move'
  | 'apple'
  | 'golden'
  | 'portal'
  | 'failure'
  | 'hint'
  | 'coin'
  | 'complete'
  | 'toggle'
  | 'key'
  | 'gate'
  | 'teleport'
  | 'ice'
  | 'crack'
  | 'rescue'
  | 'undo'
  | 'star1'
  | 'star2'
  | 'star3'

let context: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return null
  context ??= new AudioContextConstructor()
  if (context.state === 'suspended') void context.resume()
  return context
}

function playTone(
  frequency: number,
  duration: number,
  startAt: number,
  volume: number,
  waveform: OscillatorType = 'sine',
) {
  const audio = getAudioContext()
  if (!audio) return
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = waveform
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.016)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

const soundNotes: Record<SoundName, number[]> = {
  move: [392],
  apple: [523.25, 659.25],
  golden: [659.25, 783.99, 987.77],
  portal: [392, 523.25, 659.25],
  failure: [311.13, 246.94],
  hint: [587.33],
  coin: [659.25, 783.99],
  complete: [523.25, 659.25, 783.99, 1046.5],
  toggle: [440],
  key: [698.46, 880],
  gate: [329.63, 440, 523.25],
  teleport: [440, 659.25, 880, 1174.66],
  ice: [783.99, 987.77],
  crack: [261.63, 220],
  rescue: [783.99, 1046.5, 1318.51],
  undo: [440, 349.23],
  star1: [587.33],
  star2: [739.99],
  star3: [987.77, 1174.66],
}

export function playGameSound(name: SoundName, enabled: boolean) {
  if (!enabled) return
  const audio = getAudioContext()
  if (!audio) return
  const notes = soundNotes[name]
  const waveform: OscillatorType =
    name === 'crack' ? 'triangle' : name === 'teleport' || name === 'ice' ? 'triangle' : 'sine'
  const step = name === 'teleport' ? 0.055 : name === 'rescue' ? 0.07 : 0.085
  const duration = name === 'move' || name === 'undo' ? 0.07 : 0.18
  const volume = name === 'move' || name === 'undo' ? 0.018 : 0.035

  notes.forEach((frequency, index) => {
    playTone(frequency, duration, audio.currentTime + index * step, volume, waveform)
  })
}

export function playAppleComboSound(combo: number, isGolden: boolean, enabled: boolean) {
  if (!enabled) return
  const audio = getAudioContext()
  if (!audio) return
  const scaleMultiplier = Math.pow(1.06, Math.min(Math.max(combo - 1, 0), 8))
  const notes = isGolden ? soundNotes.golden : soundNotes.apple
  notes.forEach((frequency, index) => {
    playTone(frequency * scaleMultiplier, 0.18, audio.currentTime + index * 0.075, 0.036, 'sine')
  })
}

export function triggerHaptic(pattern: number | number[], enabled: boolean) {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Ignore unsupported environments
  }
}

export function startAmbientMusic() {
  const audio = getAudioContext()
  if (!audio || typeof window === 'undefined') return () => undefined
  const notes = [196, 246.94, 293.66, 246.94, 174.61, 220, 261.63, 220]
  let index = 0
  const tick = () => {
    playTone(notes[index % notes.length], 0.58, audio.currentTime, 0.006)
    if (index % 4 === 0) playTone(notes[(index + 3) % notes.length] / 2, 0.75, audio.currentTime, 0.003)
    index += 1
  }
  tick()
  const interval = window.setInterval(tick, 720)
  return () => window.clearInterval(interval)
}
