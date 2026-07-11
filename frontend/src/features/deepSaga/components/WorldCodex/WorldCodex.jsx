import { worldBible } from '../../data/worldBible'
import styles from './WorldCodex.module.css'

export function WorldCodex() {
  return (
    <section className={styles.codex} aria-label="World codex">
      <div className={styles.header}>
        <span>World Brain</span>
        <h2>10 Realms</h2>
      </div>
      <div className={styles.list}>
        {worldBible.map((place) => (
          <details className={styles.place} key={place.number}>
            <summary>
              <span>{String(place.number).padStart(2, '0')}</span>
              <strong>{place.name}</strong>
            </summary>
            <p>{place.kind}</p>
            <p>{place.theme}</p>
            <ol>
              {place.floors.map((floor, index) => (
                <li key={floor}>
                  <span>F{index + 1}</span>
                  {floor}
                </li>
              ))}
            </ol>
            <div className={styles.boss}>
              <span>Boss</span>
              <strong>{place.boss}</strong>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
