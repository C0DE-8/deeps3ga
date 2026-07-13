import styles from './ChoiceComposer.module.css'

export function ChoiceComposer({ choices, customAction, onCustomActionChange, onSubmitAction, disabled = false }) {
  function handleSubmit(event) {
    event.preventDefault()
    const action = customAction.trim()
    if (action) onSubmitAction(action, 'typed')
  }

  function normalizeChoice(choice, index) {
    if (typeof choice === 'string') return { key: `${index}-${choice}`, text: choice, action: choice, direction: '', consequence: '' }
    const text = choice?.text || choice?.label || choice?.action || `Choice ${index + 1}`
    const action = choice?.action || choice?.value || text
    return { key: choice?.id || `${index}-${text}-${action}`, text, action, direction: choice?.direction || '', consequence: choice?.consequence || '' }
  }

  return (
    <footer className={styles.composer} aria-label="Story choices">
      <div className={styles.choiceGrid}>
        {choices.map((choice, index) => {
          const normalized = normalizeChoice(choice, index)
          return (
            <button key={normalized.key} type="button" disabled={disabled} onClick={() => onSubmitAction(normalized.action, 'suggested')}>
              {normalized.direction && <small>{normalized.direction}</small>}
              <strong>{normalized.text}</strong>
              {normalized.consequence && <span>{normalized.consequence}</span>}
            </button>
          )
        })}
      </div>
      <form className={styles.actionForm} onSubmit={handleSubmit}>
        <input
          aria-label="Type your own action"
          value={customAction}
          onChange={(event) => onCustomActionChange(event.target.value)}
          placeholder="Type your own action..."
        />
        <button type="submit" disabled={disabled}>{disabled ? 'The story turns...' : 'Continue'}</button>
      </form>
    </footer>
  )
}
