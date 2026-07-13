import styles from './StoryPanel.module.css'

function DialogueBlock({ lines }) {
  if (!lines?.length) return null

  return (
    <div className={styles.dialogueGroup}>
      {lines.map((line, index) => (
        <blockquote className={styles.dialogue} key={`${line.speaker}-${index}`}>
          <span>{line.speaker}</span>
          <p>{line.text}</p>
        </blockquote>
      ))}
    </div>
  )
}

export function StoryPanel({ scene }) {
  const sectionLabels = {
    continuation: 'Continuation',
    actionResolution: 'Action resolution',
    worldReaction: 'World reaction',
    storyDevelopment: 'Story development',
    storyOpportunity: 'Story opportunity',
  }
  const narrativeSections = Object.entries(scene.narrativeSections || {}).filter(([, value]) => typeof value === 'string' && value.trim())
  const summary = scene.statusSummary
  return (
    <article className={styles.storyPanel} key={scene.id}>
      <div className={styles.chapterMark}>
        <span>{scene.chapter}</span>
        <h1>{scene.title}</h1>
      </div>

      {scene.playerAction && (
        <p className={styles.playerAction}>
          <span>Player</span>
          {scene.playerAction}
        </p>
      )}

      <section className={styles.page}>
        {narrativeSections.length ? narrativeSections.map(([key, value]) => (
          <section className={styles.narrativeSection} key={key}>
            <h2>{sectionLabels[key] || key.replace(/([A-Z])/g, ' $1')}</h2>
            {value.split(/\n\s*\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        )) : scene.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <DialogueBlock lines={scene.dialogue} />
        {scene.closing?.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <DialogueBlock lines={scene.dialogueAfter} />
        {scene.storyOpportunities?.length > 0 && (
          <section className={styles.opportunities}>
            <h2>Open threads</h2>
            <ul>{scene.storyOpportunities.map((opportunity, index) => <li key={`${index}-${typeof opportunity === 'string' ? opportunity : opportunity.title}`}>{typeof opportunity === 'string' ? opportunity : opportunity.title || opportunity.text}</li>)}</ul>
          </section>
        )}
        {summary && (
          <section className={styles.statusSummary} aria-label="Current status summary">
            <h2>Current condition</h2>
            <dl>
              <div><dt>Level</dt><dd>{summary.level}</dd></div>
              <div><dt>HP</dt><dd>{summary.hp}</dd></div>
              <div><dt>Stamina</dt><dd>{summary.stamina}</dd></div>
              <div><dt>Mana</dt><dd>{summary.mana}</dd></div>
              <div><dt>Gold</dt><dd>{summary.gold}</dd></div>
              <div><dt>Weapon</dt><dd>{summary.equippedWeapon}</dd></div>
            </dl>
            {summary.activeQuests?.length > 0 && <p><strong>Active quests:</strong> {summary.activeQuests.join(', ')}</p>}
            {summary.relevantInventory?.length > 0 && <p><strong>Relevant inventory:</strong> {summary.relevantInventory.join(', ')}</p>}
            {summary.companions?.length > 0 && <p><strong>Companions:</strong> {summary.companions.join(', ')}</p>}
            {summary.statusEffects?.length > 0 && <p><strong>Status:</strong> {summary.statusEffects.join(', ')}</p>}
          </section>
        )}
      </section>
    </article>
  )
}
