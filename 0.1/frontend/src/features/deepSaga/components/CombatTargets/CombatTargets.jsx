import { Crosshair } from 'lucide-react'
import styles from './CombatTargets.module.css'

export function CombatTargets({ targets, disabled, onTarget }) {
  const activeTargets = (targets || []).filter((entry) => entry.reachable && !['defeated', 'dead', 'fled', 'spared'].includes(entry.status))
  if (!activeTargets.length) return null
  return (
    <section className={styles.targets} aria-label="Combat targets">
      <span><Crosshair size={15} /> Choose a target</span>
      <div>{activeTargets.map((target) => <button type="button" disabled={disabled} key={`${target.type}-${target.id}`} onClick={() => onTarget({ playerAction: 'attack', selectedTarget: { type: target.type, id: target.id, name: target.name } })}><strong>{target.name}</strong><small>{target.hp}/{target.maxHp} HP</small></button>)}</div>
    </section>
  )
}
