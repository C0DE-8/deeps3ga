import styles from './ChoiceComposer.module.css'

export function ChoiceComposer({ choices, customAction, onCustomActionChange, onSubmitAction }) {
  function handleSubmit(event) {
    event.preventDefault()
    const action = customAction.trim()
    if (action) onSubmitAction(action)
  }

  return (
    <footer className={styles.composer} aria-label="Story choices">
      <div className={styles.choiceGrid}>
        {choices.map((choice) => (
          <button key={choice} type="button" onClick={() => onSubmitAction(choice)}>
            {choice}
          </button>
        ))}
      </div>
      <form className={styles.actionForm} onSubmit={handleSubmit}>
        <input
          aria-label="Type your own action"
          value={customAction}
          onChange={(event) => onCustomActionChange(event.target.value)}
          placeholder="Type your own action..."
        />
        <button type="submit">Continue</button>
      </form>
    </footer>
  )
}
