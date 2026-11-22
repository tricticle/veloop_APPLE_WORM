import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Lightbulb, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Direction } from '@/lib/game/engine'

type GameControlsProps = {
  disabled?: boolean
  busy?: boolean
  canUndo: boolean
  hintDirection: Direction | null
  onMove: (direction: Direction) => void
  onUndo: () => void
  onHint: () => void
  onRestart: () => void
}

const directionButtons: Array<{ direction: Direction; label: string; Icon: typeof ArrowUp; className: string }> = [
  { direction: 'up', label: 'Move up', Icon: ArrowUp, className: 'direction-up' },
  { direction: 'left', label: 'Move left', Icon: ArrowLeft, className: 'direction-left' },
  { direction: 'down', label: 'Move down', Icon: ArrowDown, className: 'direction-down' },
  { direction: 'right', label: 'Move right', Icon: ArrowRight, className: 'direction-right' },
]

export function GameControls({   disabled = false,
  busy = false,
  canUndo, hintDirection, onMove, onUndo, onHint, onRestart }: GameControlsProps) {
  return (
    <div className="game-controls">
      <div className="direction-pad" role="group" aria-label="Worm movement controls">
        {directionButtons.map(({ direction, label, Icon, className }) => (
          <Button
            key={direction}
            className={`direction-button ${className} ${hintDirection === direction ? 'direction-hint' : ''}`}
            variant="secondary"
            size="icon-lg"
            aria-label={label}
            disabled={disabled}
            onClick={() => onMove(direction)}
          >
            <Icon aria-hidden="true" />
          </Button>
        ))}
        <span className="direction-center" aria-hidden="true" />
      </div>
      <div className="utility-controls" role="group" aria-label="Level actions">
        <Button variant="outline" size="sm" className="utility-button" disabled={!canUndo || busy} onClick={onUndo}>
          <Undo2 data-icon="inline-start" aria-hidden="true" /> Undo
        </Button>
        <Button variant="outline" size="sm" className="utility-button" disabled={disabled} onClick={onHint}>
          <Lightbulb data-icon="inline-start" aria-hidden="true" /> Hint
        </Button>
        <Button variant="ghost" size="sm" className="utility-button utility-restart" disabled={busy} onClick={onRestart}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" /> Restart
        </Button>
      </div>
      <p className="control-hint"><kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd><span>or swipe the board</span></p>
    </div>
  )
}
