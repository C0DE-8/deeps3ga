import styles from './CharacterSheet.module.css'

function ListSection({ title, items }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
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
        <p>{character.species || character.race} / {character.race} / {character.className}</p>
      </div>
      <section className={styles.section}>
        <h3>Progress</h3>
        <dl className={styles.stats}>
          <div><dt>Level</dt><dd>{character.level}</dd></div>
          <div><dt>XP</dt><dd>{character.xp}/{character.xpNeeded}</dd></div>
          <div><dt>Health</dt><dd>{character.health}</dd></div>
          <div><dt>HP</dt><dd>{character.hp}/{character.maxHp}</dd></div>
          <div><dt>Mana</dt><dd>{character.mana}/{character.maxMana}</dd></div>
          <div><dt>Stamina</dt><dd>{character.stamina}/{character.maxStamina}</dd></div>
          <div><dt>Gold</dt><dd>{character.gold}</dd></div>
          <div><dt>Soul Energy</dt><dd>{character.soulEnergy}</dd></div>
        </dl>
      </section>
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
      <ListSection title="Traits" items={character.traits} />
      <ListSection title="Inventory" items={character.inventory} />
      <ListSection title="Equipment" items={character.equipment} />
      <ListSection title="Titles" items={character.titles} />
      <ListSection title="Status Effects" items={character.statuses} />
      <ListSection title="Injuries" items={character.injuries} />
      <ListSection title="Companions" items={character.companions} />
      <ListSection title="Skill Families" items={character.familyMastery} />
      <ListSection title="Evolution Choices" items={character.evolutions} />
      <ListSection title="Ultimate Trials" items={character.ultimateTrials} />
      <ListSection title="Soul Memories" items={character.memories} />
      {character.legacyHero && (
        <section className={styles.section}>
          <h3>Previous Legend</h3>
          <p>{character.legacyHero.hero_name}</p>
          <p>{character.legacyHero.final_title}</p>
          <p>Legacy #{character.legacyHero.legacy_number}</p>
        </section>
      )}
      <section className={styles.section}>
        <h3>Current Position</h3>
        <dl className={styles.stats}>
          <div><dt>Dungeon</dt><dd>{character.position.dungeon}</dd></div>
          <div><dt>Floor</dt><dd>{character.position.floor}</dd></div>
          <div><dt>Chapter</dt><dd>{character.position.chapter}</dd></div>
          <div><dt>Scene</dt><dd>{character.position.scene}</dd></div>
          <div><dt>Soul ID</dt><dd>{character.soulId}</dd></div>
          <div><dt>Character ID</dt><dd>{character.characterId}</dd></div>
        </dl>
      </section>
      <section className={styles.section}>
        <h3>Reincarnation History</h3>
        <ul>
          {character.lifeHistory.map((life) => (
            <li key={life.character_id}>Life {life.life_number} · Character {life.character_id} · {life.status}</li>
          ))}
        </ul>
      </section>
    </details>
  )
}
