import { Crosshair } from 'lucide-react'
import styles from './CombatTargets.module.css'

export function CombatTargets({ participants, disabled, onTarget }) {
  const enemies = (participants || []).filter((entry) => entry.team === 'enemy' && entry.status === 'active')
  if (!enemies.length) return null
  return (
    <section className={styles.targets} aria-label="Combat targets">
      <span><Crosshair size={15} /> Choose a target</span>
      <div>{enemies.map((enemy) => <button type="button" disabled={disabled} key={enemy.id} onClick={() => onTarget(`I attack ${enemy.display_name}.`)}><strong>{enemy.display_name}</strong><small>{enemy.current_hp}/{enemy.max_hp} HP</small></button>)}</div>
    </section>
  )
}
