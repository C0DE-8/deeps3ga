import styles from './CharacterSheet.module.css'

function ListSection({ title, items }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function CharacterSheet({ character }) {
  return (
    <details className={styles.sheet}>
      <summary>Character Sheet</summary>
      <div className={styles.identity}>
        <h2>{character.name}</h2>
        <p>{character.race} / {character.className}</p>
      </div>
      <section className={styles.section}>
        <h3>Stats</h3>
        <dl className={styles.stats}>
          {character.stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <ListSection title="Skills" items={character.skills} />
      <ListSection title="Inventory" items={character.inventory} />
      <ListSection title="Titles" items={character.titles} />
    </details>
  )
}
