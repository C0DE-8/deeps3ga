import { BookOpenCheck, Coins, Crown, Footprints, Shield, Sparkles, Swords } from 'lucide-react'
import styles from './EngineResults.module.css'

const icons = {
  damage: Swords,
  healing: Shield,
  status_added: Sparkles,
  status_damage: Swords,
  status_expired: Footprints,
  stamina: Footprints,
  mana: Sparkles,
  gold: Coins,
  item: Crown,
  quest: BookOpenCheck,
  relationship: Shield,
  floor: Footprints,
}

export function EngineResults({ recordChanges }) {
  if (!Array.isArray(recordChanges) || !recordChanges.length) return null
  return (
    <section className={styles.results} aria-label="Game changes">
      <span className={styles.heading}>The record changes</span>
      <div>
        {recordChanges.map((record, index) => {
          const Icon = icons[record.type] || BookOpenCheck
          return <span key={`${index}-${record.type}-${record.text}`}><Icon size={14} />{record.text}</span>
        })}
      </div>
    </section>
  )
}
