import styles from './PhaseFlow.module.css'

export function PhaseFlow({ phases }) {
  return (
    <section className={styles.phaseFlow} aria-label="Deep Saga phase flow">
      {phases.map((phase) => (
        <article className={styles.phaseCard} key={phase.phase}>
          <span>Phase {phase.phase}</span>
          <h2>{phase.title}</h2>
          <p>{phase.summary}</p>
        </article>
      ))}
    </section>
  )
}
