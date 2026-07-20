import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, BookOpen, ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { continueNarrative, createOpeningNarrative, fetchGameState, startGame } from '../../../api/deepSagaApi'
import { AppHeader } from '../../shell/AppHeader'
import styles from './StoryPage.module.css'

function latestChoices(state) {
  const narrator = [...(state?.narrativeHistory || [])].reverse().find((message) => message.speaker === 'narrator')
  return Array.isArray(narrator?.choices_json) ? narrator.choices_json : []
}

function storyEntries(state) {
  return (state?.narrativeHistory || []).filter((message) => ['player', 'narrator'].includes(message.speaker))
}

function storyScenes(messages, game) {
  const scenes = []
  let playerAction = null

  for (const message of messages) {
    if (message.speaker === 'player') {
      playerAction = message
      continue
    }

    if (message.speaker !== 'narrator') continue

    scenes.push({
      id: message.id,
      playerAction,
      narrator: message,
      chapter: game?.currentDungeon?.name || 'Deep Saga',
      title: game?.currentFloor?.floor_name || 'The next page',
      floor: game?.currentFloor?.floor_number || 1,
      purpose: game?.currentFloor?.story_purpose || 'The story continues.',
      paragraphs: String(message.message_text || '').split(/\n\s*\n/).map((entry) => entry.trim()).filter(Boolean),
      recordChanges: Array.isArray(message.record_changes_json) ? message.record_changes_json : [],
    })
    playerAction = null
  }

  if (playerAction) {
    scenes.push({
      id: playerAction.id,
      playerAction,
      narrator: null,
      chapter: game?.currentDungeon?.name || 'Deep Saga',
      title: game?.currentFloor?.floor_name || 'The next page',
      floor: game?.currentFloor?.floor_number || 1,
      purpose: game?.currentFloor?.story_purpose || 'The story continues.',
      paragraphs: [],
    })
  }

  return scenes
}

function numberValue(value, fallback = 0) {
  return Number(value ?? fallback)
}

function StatLine({ label, value }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  )
}

function cleanMarkdown(value) {
  return String(value || '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
}

const CHAPTERS = [
  { number: 'One', title: 'The Rebirth Crucible', subtitle: 'The Hunter Beneath the Web' },
  { number: 'Two', title: 'The Puppet Court', subtitle: 'The Laughing Demon Lord' },
  { number: 'Three', title: 'The Dragon in the Stone', subtitle: 'The Trial of Araba' },
  { number: 'Four', title: 'The Mother Nest', subtitle: 'The Queen Above All Threads' },
  { number: 'Five', title: 'The Saint Draws Steel', subtitle: 'The Blade That Hates Monsters' },
  { number: 'Six', title: 'The Demon Throne', subtitle: 'The Ancient Crown of Ariel' },
  { number: 'Seven', title: 'The Nation Breaker', subtitle: 'The Child With Catastrophe in Her Fists' },
  { number: 'Eight', title: 'The Storm Unsealed', subtitle: 'The True Dragon Laughs' },
  { number: 'Nine', title: 'The Crimson End', subtitle: 'The Strongest Demon Lord' },
  { number: 'Ten', title: 'The Administrator Watches', subtitle: 'The Last Page of the Game' },
]

function chapterFor(stage) {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, Number(stage || 1) - 1))]
}

function bossName(boss, fallback) {
  return boss?.bossName || boss?.boss_name || fallback || 'The boss'
}

function bossCondition(boss) {
  if (!boss?.maxHp) return 'The enemy waits beyond the next line of ink.'
  const current = Number(boss.currentHp ?? boss.current_hp ?? boss.maxHp)
  const max = Number(boss.maxHp ?? boss.max_hp)
  const ratio = max > 0 ? current / max : 1

  if (current <= 0 || boss.status === 'defeated') return 'The body has fallen. The chapter is ready to turn.'
  if (ratio <= 0.25) return 'The enemy is breaking, but the killing intent has only sharpened.'
  if (ratio <= 0.5) return 'Fresh wounds split the enemy guard, and every movement costs more than before.'
  if (ratio <= 0.75) return 'The enemy carries visible damage now, though confidence has not fully cracked.'
  return 'The enemy guard remains strong, every movement steady, and pride untouched.'
}

function InlineText({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function isKeyValueLine(line) {
  return /^(\*\*)?[\w\s().'-]{2,40}:(\*\*)?\s+/.test(line)
}

function isListLine(line) {
  return /^[-•]\s+/.test(line)
}

function StoryBlock({ block }) {
  const lines = String(block || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null

  const first = lines[0]
  const normalizedFirst = cleanMarkdown(first).toLowerCase()
  const isSkillCallout = normalizedFirst.includes('new skill') || normalizedFirst.includes('skill acquired') || normalizedFirst.includes('skill choice') || normalizedFirst.includes('skill awakening')
  const isEndingCallout = normalizedFirst.includes('book complete') || normalizedFirst.includes('book ended') || normalizedFirst.includes('ending')
  const isStructured = lines.length > 1 && lines.slice(1).some((line) => isKeyValueLine(line) || isListLine(line))

  if (isEndingCallout) {
    return (
      <section className={styles.endingCallout}>
        <strong><InlineText text={first} /></strong>
        {lines.slice(1).map((line) => <p key={line}><InlineText text={line} /></p>)}
      </section>
    )
  }

  if (isSkillCallout) {
    return (
      <section className={styles.skillCallout}>
        <strong><InlineText text={first} /></strong>
        {lines.slice(1).map((line) => <p key={line}><InlineText text={line} /></p>)}
      </section>
    )
  }

  if (isStructured) {
    const heading = cleanMarkdown(first)
    const rows = lines.slice(1)

    return (
      <section className={styles.infoBlock}>
        <h3>{heading}</h3>
        <ul>
          {rows.map((line) => {
            const text = line.replace(/^[-•]\s+/, '')
            return <li key={line}><InlineText text={text} /></li>
          })}
        </ul>
      </section>
    )
  }

  if (lines.length === 1 && cleanMarkdown(first).length <= 60 && /^(\*\*)?.+(\*\*)?$/.test(first) && !first.endsWith('.')) {
    return <h3 className={styles.storyHeading}><InlineText text={first} /></h3>
  }

  return <p className={styles.storyParagraph}>{lines.map((line, index) => <InlineText key={`${line}-${index}`} text={index ? ` ${line}` : line} />)}</p>
}

function StoryText({ paragraphs }) {
  return (
    <div className={styles.storyText}>
      {paragraphs.map((paragraph) => <StoryBlock block={paragraph} key={paragraph} />)}
    </div>
  )
}

function StatsMessage({ sheet }) {
  const character = sheet?.character || {}
  const runtime = sheet?.floorRuntime || {}
  const skills = Array.isArray(sheet?.skills) ? sheet.skills : []
  const memoryLog = Array.isArray(sheet?.memoryLog) ? sheet.memoryLog : []

  return (
    <div className={styles.statsMessage}>
      <header>
        <small>Character sheet</small>
        <h2>{character.characterName || 'Unnamed Soul'}</h2>
        <p>{character.race || 'Unknown'} · {character.className || 'Reincarnated Monster'}</p>
      </header>

      <section className={styles.statsGrid}>
        <StatLine label="Level" value={numberValue(character.level, 1)} />
        <StatLine label="XP" value={`${numberValue(character.xp, 0)}/${numberValue(character.xpNeeded, 100)}`} />
        <StatLine label="HP" value={`${numberValue(character.hp, 0)}/${numberValue(character.maxHp, 0)}`} />
        <StatLine label="Mana" value={`${numberValue(character.mana, 0)}/${numberValue(character.maxMana, 0)}`} />
        <StatLine label="Stamina" value={`${numberValue(character.stamina, 0)}/${numberValue(character.maxStamina, 0)}`} />
        <StatLine label="Gold" value={numberValue(character.gold, 0)} />
        <StatLine label="Soul Energy" value={numberValue(character.soulEnergy, 0)} />
      </section>

      <section className={styles.abilityGrid}>
        <StatLine label="Strength" value={numberValue(character.strength, 5)} />
        <StatLine label="Agility" value={numberValue(character.agility, 5)} />
        <StatLine label="Defense" value={numberValue(character.defense, 5)} />
        <StatLine label="Thaumaturgy" value={numberValue(character.thaumaturgy, 5)} />
        <StatLine label="Resolve" value={numberValue(character.resolve, 5)} />
        <StatLine label="Intelligence" value={numberValue(character.intelligence, 5)} />
        <StatLine label="Luck" value={numberValue(character.luck, 5)} />
        <StatLine label="Charisma" value={numberValue(character.charisma, 5)} />
      </section>

      <section className={styles.sheetSection}>
        <small>Current position</small>
        <p>{runtime.dungeonAiName || runtime.dungeonLabel || 'Dungeon 1'} · Floor {runtime.floorNumber || character.floor || 1}</p>
      </section>

      <section className={styles.sheetSection}>
        <small>Learned skills</small>
        <div className={styles.skillList}>
          {skills.length ? skills.map((skill) => (
            <span key={skill.id || skill.key || skill.name}>
              <strong>{skill.name}</strong>
              <em>Lv. {skill.level || skill.skill_level || 1}</em>
              <small>{skill.family || skill.type || 'Skill'}</small>
            </span>
          )) : <p>No learned skills recorded yet.</p>}
        </div>
      </section>

      {memoryLog.length > 0 && (
        <section className={styles.sheetSection}>
          <small>Soul memory</small>
          <p>{memoryLog.slice(-2).join(' ')}</p>
        </section>
      )}
    </div>
  )
}

export function StoryPage() {
  const { cycleId } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState(null)
  const [choices, setChoices] = useState([])
  const [action, setAction] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const endRef = useRef(null)

  async function loadStory(id) {
    const loaded = await fetchGameState(id)
    if (!storyEntries(loaded).length) {
      const opening = await createOpeningNarrative()
      const reloaded = await fetchGameState(id)
      setGame(reloaded)
      setChoices(opening.choices || latestChoices(reloaded))
      return
    }

    setGame(loaded)
    setChoices(latestChoices(loaded))
  }

  useEffect(() => {
    let active = true

    async function open() {
      setBusy(true)
      setError('')
      try {
        const loaded = await fetchGameState(cycleId)
        if (!active) return
        if (!storyEntries(loaded).length) {
          const opening = await createOpeningNarrative()
          if (!active) return
          const reloaded = await fetchGameState(cycleId)
          if (!active) return
          setGame(reloaded)
          setChoices(opening.choices || latestChoices(reloaded))
        } else {
          setGame(loaded)
          setChoices(latestChoices(loaded))
        }
      } catch (requestError) {
        if (requestError.status !== 404) {
          if (active) setError(requestError.message || 'This story could not be opened.')
          return
        }
        try {
          const started = await startGame()
          if (active) navigate(`/read/${started.storyCycleId}`, { replace: true })
        } catch (startError) {
          if (active) setError(startError.message || 'A new story could not begin.')
        }
      } finally {
        if (active) setBusy(false)
      }
    }

    open()
    return () => { active = false }
  }, [cycleId, navigate])

  const messages = useMemo(() => storyEntries(game), [game])
  const scenes = useMemo(() => storyScenes(messages, game), [messages, game])
  const sheet = game?.characterSheet
  const boss = game?.currentBoss
  const ended = Boolean(game?.run?.book_ended || game?.run?.character_status !== 'alive' || game?.run?.status === 'completed')
  const endingLabel = game?.run?.ending_type === 'victory'
    ? 'Book complete'
    : game?.run?.ending_type === 'death'
      ? 'Book ended'
      : 'Book closed'

  useEffect(() => {
    if (scenes.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scenes.length])

  async function submit(playerAction, actionKind = 'typed', selectedTarget = null) {
    if (busy || !playerAction.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await continueNarrative({
        storyCycleId: Number(cycleId),
        playerAction: playerAction.trim(),
        actionKind,
        selectedTarget,
        requestKey: crypto.randomUUID(),
      })
      setAction('')
      setChoices(result.choices || [])
      if (result.localOnly) {
        setGame((current) => current ? {
          ...current,
          narrativeHistory: [...(current.narrativeHistory || []), ...(result.messages || [])],
        } : current)
        return
      }
      await loadStory(cycleId)
    } catch (requestError) {
      setError(requestError.message || 'The narrator fell silent.')
    } finally {
      setBusy(false)
    }
  }

  const initialStory = game?.currentFloor?.description || 'Your last breath is gone. Cold earth and an unfamiliar body remain.'
  const stage = game?.currentDungeon?.boss_stage || game?.currentDungeon?.dungeon_number || 1
  const chapter = chapterFor(stage)
  const currentBossName = bossName(boss, game?.currentFloor?.floor_name || game?.currentDungeon?.name)
  const bossState = bossCondition(boss)

  return (
    <main className={styles.page}>
      <AppHeader />
      {sheet && (
        <div className={styles.statusBar}>
          <span><small>HP</small><strong>{sheet.hp}/{sheet.max_hp}</strong></span>
          <span><small>Mana</small><strong>{sheet.mana}/{sheet.max_mana}</strong></span>
          <span><small>Stamina</small><strong>{sheet.stamina}/{sheet.max_stamina}</strong></span>
          <span><small>Level</small><strong>{sheet.level}</strong></span>
          <span><small>Chapter</small><strong>{chapter.number}</strong></span>
          <span className={styles.position}><small>{ended ? endingLabel : currentBossName}</small><strong>{chapter.title}</strong></span>
          <button type="button" onClick={() => setSheetOpen((open) => !open)} title={sheetOpen ? 'Close character sheet' : 'Open character sheet'}>
            {sheetOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </button>
        </div>
      )}

      <aside className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ''}`} aria-hidden={!sheetOpen}>
        {sheet && <><span>Character sheet</span><h2>{sheet.character_name}</h2><p>{sheet.race_name} · {sheet.class_name}</p><dl><dt>Status</dt><dd>{game.run.character_status}</dd><dt>Chapter</dt><dd>{chapter.number}: {chapter.title}</dd><dt>Boss</dt><dd>{currentBossName}</dd>{boss && <><dt>Condition</dt><dd>{bossState}</dd></>}<dt>Gold</dt><dd>{sheet.gold}</dd><dt>XP</dt><dd>{sheet.xp}/{sheet.xp_needed}</dd><dt>Skills</dt><dd>{game.skills.map((skill) => skill.name).join(', ') || 'None'}</dd><dt>Inventory</dt><dd>{game.inventory.map((item) => item.name).join(', ') || 'Empty'}</dd></dl></>}
      </aside>

      <section className={styles.reader}>
        <div className={styles.story}>
          {!scenes.length && !busy && (
            <article className={styles.bookPanel}>
              <header className={styles.sceneChapter}>
                <span>Chapter {chapter.number} · {chapter.title}</span>
                <h1>{chapter.subtitle}</h1>
                <p><strong>{currentBossName}</strong> · {bossState}</p>
              </header>
              <section className={styles.scenePage}><BookOpen /><p>{initialStory}</p></section>
            </article>
          )}

          {scenes.length > 0 && (
            <article className={styles.bookPanel}>
              <header className={styles.sceneChapter}>
                <span>Chapter {chapter.number} · {chapter.title}</span>
                <h1>{chapter.subtitle}</h1>
                <p><strong>{currentBossName}</strong> · {bossState}</p>
              </header>

              <div className={styles.sceneFlow}>
                {scenes.map((scene, index) => {
                  const latest = index === scenes.length - 1
                  return (
                    <section className={`${styles.sceneEntry} ${latest ? styles.sceneEntryLatest : styles.sceneEntryOld}`} key={scene.id} ref={latest ? endRef : null}>
                      {scene.playerAction && (
                        <div className={styles.playerAction}>
                          <span>Player</span>
                          <p>{scene.playerAction.message_text}</p>
                        </div>
                      )}

                      <div className={styles.scenePage}>
                        {scene.narrator?.message_kind === 'stats' ? (
                          <StatsMessage sheet={scene.narrator.sheet_json} />
                        ) : (
                          <>
                            <StoryText paragraphs={scene.paragraphs} />
                          </>
                        )}
                      </div>

                      {!latest && <ChevronDown className={styles.pageBreak} size={18} />}
                    </section>
                  )
                })}
              </div>
            </article>
          )}
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {busy && <p className={styles.loading}>The next page is being written...</p>}

        {!busy && !ended && (
          <section className={styles.actions}>
            {choices.length > 0 && <><p className={styles.choicePrompt}>The next line is yours.</p><div className={styles.choiceList}>{choices.map((choice, index) => <button type="button" key={choice.id || `${choice.action}-${index}`} onClick={() => submit(choice.action || choice.text, 'suggested')}><strong>{choice.title || choice.text}</strong>{choice.text && choice.title && <span>{choice.text}</span>}</button>)}</div></>}
            <form onSubmit={(event) => { event.preventDefault(); submit(action) }}>
              <label htmlFor="custom-action">Write your own action</label>
              <div><textarea id="custom-action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="I keep my blade low and ask what wounded it..." rows="3" maxLength="1000" /><button type="submit" disabled={!action.trim()} title="Submit action"><ArrowUp /></button></div>
            </form>
          </section>
        )}
        {ended && (
          <section className={styles.endPanel}>
            <small>{endingLabel}</small>
            <h2>{game?.run?.ending_type === 'victory' ? 'The coma breaks.' : 'The page goes dark.'}</h2>
            <p>{game?.run?.ending_type === 'victory' ? 'This life is recorded as a completed book.' : 'This life is recorded as a death ending.'}</p>
            <Link className={styles.returnLink} to="/library">Return to your stories</Link>
          </section>
        )}
      </section>
    </main>
  )
}
