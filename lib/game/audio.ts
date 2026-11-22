export type SoundName = 'move' | 'apple' | 'golden' | 'portal' | 'failure' | 'hint' | 'coin' | 'complete' | 'toggle'

let context: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return null
  context ??= new AudioContextConstructor()
  if (context.state === 'suspended') void context.resume()
  return context
}

function playTone(frequency: number, duration: number, startAt: number, volume: number, waveform: OscillatorType = 'sine') {
  const audio = getAudioContext()
  if (!audio) return
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = waveform
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.018)
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
}

export function playGameSound(name: SoundName, enabled: boolean) {
  if (!enabled) return
  const audio = getAudioContext()
  if (!audio) return
  const notes = soundNotes[name]
  notes.forEach((frequency, index) => {
    playTone(frequency, name === 'move' ? 0.07 : 0.18, audio.currentTime + index * 0.085, name === 'move' ? 0.018 : 0.035)
  })
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
