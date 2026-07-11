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
        {scene.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <DialogueBlock lines={scene.dialogue} />
        {scene.closing?.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <DialogueBlock lines={scene.dialogueAfter} />
      </section>
    </article>
  )
}
