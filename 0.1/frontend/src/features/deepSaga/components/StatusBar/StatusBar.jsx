import styles from './StatusBar.module.css'

export function StatusBar({ status, skills = [] }) {
  const items = [
    ['HP', status.maxHp ? `${status.hp}/${status.maxHp}` : status.hp],
    ['MP', status.maxMp ? `${status.mp}/${status.maxMp}` : status.mp],
    ['Level', status.level],
  ]

  return (
    <header className={styles.statusBar} aria-label="Current character status">
      {items.map(([label, value]) => (
        <div className={styles.statusItem} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      {skills.map((skill) => (
        <div className={`${styles.statusItem} ${styles.skillItem}`} key={skill.skill_key || skill.name}>
          <span>Skill · Lv.{skill.skill_level}</span>
          <strong>{skill.name}</strong>
        </div>
      ))}
    </header>
  )
}
