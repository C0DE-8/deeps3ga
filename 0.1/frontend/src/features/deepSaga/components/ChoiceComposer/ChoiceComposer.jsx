import styles from './ChoiceComposer.module.css'

export function ChoiceComposer({ choices, customAction, onCustomActionChange, onSubmitAction, disabled = false }) {
  function handleSubmit(event) {
    event.preventDefault()
    const action = customAction.trim()
    if (action) onSubmitAction(action, 'typed')
  }

  function normalizeChoice(choice, index) {
    if (typeof choice === 'string') return { key: `${index}-${choice}`, title: choice, text: '', action: choice, direction: '', consequence: '' }
    const text = choice?.text || choice?.label || choice?.action || `Choice ${index + 1}`
    const title = choice?.title || choice?.label || text
    const action = choice?.action || choice?.value || text
    return { key: choice?.id || `${index}-${text}-${action}`, title, text, action, direction: choice?.direction || '', consequence: choice?.consequence || '', targetType: choice?.targetType || null, targetId: choice?.targetId ?? null }
  }

  return (
    <footer className={styles.composer} aria-label="Story choices">
      <div className={styles.choiceGrid}>
        {choices.map((choice, index) => {
          const normalized = normalizeChoice(choice, index)
          return (
            <button key={normalized.key} type="button" disabled={disabled} onClick={() => onSubmitAction(normalized.action, 'suggested', normalized.targetType && normalized.targetId !== null ? { type: normalized.targetType, id: normalized.targetId } : null)}>
              {normalized.direction && <small>{normalized.direction}</small>}
              <strong>{normalized.title}</strong>
              {normalized.text && normalized.text !== normalized.title && <span>{normalized.text}</span>}
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
