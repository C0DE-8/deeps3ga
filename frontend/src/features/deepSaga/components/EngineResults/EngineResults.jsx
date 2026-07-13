import { BookOpenCheck, Coins, Crown, Footprints, Shield, Sparkles, Swords } from 'lucide-react'
import styles from './EngineResults.module.css'

export function EngineResults({ resolution }) {
  if (!resolution) return null
  const entries = []
  if (resolution.combat?.playerDamage) entries.push({ icon: Swords, label: `${resolution.combat.playerDamage} damage to ${resolution.combat.enemyName}` })
  if (resolution.combat?.enemyDamage) entries.push({ icon: Shield, label: `${resolution.combat.enemyDamage} HP lost` })
  if (resolution.rewards?.xp) entries.push({ icon: Sparkles, label: `+${resolution.rewards.xp} XP` })
  if (resolution.rewards?.gold) entries.push({ icon: Coins, label: `+${resolution.rewards.gold} Gold` })
  if (resolution.levelUp) entries.push({ icon: Sparkles, label: `Level ${resolution.levelUp.newLevel}` })
  for (const item of resolution.itemsAwarded || []) entries.push({ icon: Crown, label: item.name })
  for (const skill of resolution.skillsUnlocked || []) entries.push({ icon: Sparkles, label: `Skill unlocked: ${skill.name}` })
  for (const quest of resolution.quests || []) entries.push({ icon: BookOpenCheck, label: `${quest.name}: ${quest.status}${quest.progress ? ` ${quest.progress}/${quest.required}` : ''}` })
  if (resolution.advanced?.type === 'floor') entries.push({ icon: Footprints, label: `Floor ${resolution.advanced.floor} reached` })
  if (resolution.advanced?.type === 'realm') entries.push({ icon: Footprints, label: `Realm ${resolution.advanced.dungeon} reached` })
  if (resolution.died) entries.push({ icon: Crown, label: 'This body has died' })
  if (resolution.runCompleted) entries.push({ icon: Crown, label: 'Legend completed' })
  if (!entries.length) return null

  return (
    <section className={styles.results} aria-label="Game changes">
      <span className={styles.heading}>The record changes</span>
      <div>
        {entries.map(({ icon: Icon, label }, index) => <span key={`${index}-${label}`}><Icon size={14} />{label}</span>)}
      </div>
    </section>
  )
}
