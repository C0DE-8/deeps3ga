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
  if (resolution.consumableUsed) entries.push({ icon: Shield, label: `${resolution.consumableUsed.name} used` })
  for (const item of resolution.itemsAwarded || []) entries.push({ icon: Crown, label: item.name })
  for (const skill of resolution.skillsUnlocked || []) entries.push({ icon: Sparkles, label: `Skill unlocked: ${skill.name}` })
  for (const quest of resolution.quests || []) entries.push({ icon: BookOpenCheck, label: `${quest.name}: ${quest.status}${quest.progress ? ` ${quest.progress}/${quest.required}` : ''}` })
  for (const event of resolution.events || []) entries.push({ icon: Sparkles, label: `${event.name}: ${event.status}` })
  for (const companion of resolution.companions || []) entries.push({ icon: Shield, label: `${companion.name}: ${companion.status}` })
  for (const action of resolution.companionActions || []) entries.push({ icon: Swords, label: `${action.name}: ${action.action}${action.damage ? ` ${action.damage} damage` : ''}` })
  for (const status of resolution.statusChanges || []) entries.push({ icon: Shield, label: `${status.status}${status.damage ? `: ${status.damage} damage` : ' ended'}` })
  for (const achievement of resolution.achievements || []) entries.push({ icon: Crown, label: `Achievement: ${achievement.name}` })
  if (resolution.evolutionChosen) entries.push({ icon: Sparkles, label: `Evolved into ${resolution.evolutionChosen.name}` })
  for (const trial of resolution.ultimateTrials || []) entries.push({ icon: Crown, label: `${trial.trialKey}: ${trial.status} ${trial.progress}/${trial.required}` })
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
