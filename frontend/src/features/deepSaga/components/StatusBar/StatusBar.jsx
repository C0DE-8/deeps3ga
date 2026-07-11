import styles from './StatusBar.module.css'

export function StatusBar({ status }) {
  const items = [
    ['HP', status.hp],
    ['MP', status.mp],
    ['Level', status.level],
    ['Dungeon', status.dungeon],
    ['Floor', status.floor],
  ]

  return (
    <header className={styles.statusBar} aria-label="Current character status">
      {items.map(([label, value]) => (
        <div className={styles.statusItem} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </header>
  )
}
