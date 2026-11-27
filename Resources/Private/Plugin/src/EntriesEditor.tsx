import { useMemo, useState } from 'react'
import {
  Button,
  Icon,
  useAssetPickerActive,
  type PropertyEditorProps,
} from '@medienreaktor/neos-studio'
import { EntriesDialog } from './EntriesDialog'
import {
  createEntry,
  normalizeEntries,
  parseOptions,
  valueKey,
  type Entry,
} from './entries'
import { configuredLabel, t, tp, useTranslationsReady } from './i18n'
import { RowText } from './RowText'
import { useEntryLabels } from './useEntryLabels'

interface Session {
  draft: Entry[]
  selectedId: string | null
  /** The stored value when the dialog opened (or the conflict was resolved): a change means someone else saved. */
  baseKey: string
  /** The draft as opened (or as loaded from theirs): Cancel only asks when the draft differs. */
  initialKey: string
  /** Remounts the field editors when the draft is replaced underneath them. */
  revision: number
}

export function EntriesEditor({
  subject,
  value,
  onCommit,
  options: rawOptions,
  id,
  invalid,
  nodeAddress,
}: PropertyEditorProps) {
  useTranslationsReady()
  const options = useMemo(() => parseOptions(rawOptions), [rawOptions])
  const storedKey = valueKey(value)
  // Keyed by the stored value, so ids generated for entries without one stay stable between renders.
  const entries = useMemo(() => normalizeEntries(value), [storedKey])
  // Kept outside the dialog content: the dialog unmounts while the Media Library is open.
  const [session, setSession] = useState<Session | null>(null)
  const picking = useAssetPickerActive()

  const open = (index?: number) => {
    const draft = entries.length === 0 ? [createEntry(options.fields)] : entries
    const selected = draft[index ?? 0] ?? draft[0]
    setSession({
      draft,
      selectedId: selected._id,
      baseKey: storedKey,
      initialKey: valueKey(draft),
      revision: 0,
    })
  }

  // Compared with the stored value, not the draft as opened: the new entry of an empty list
  // is saved even untouched, and after "Keep mine" the draft overwrites theirs.
  const apply = (draft: Entry[]) => {
    if (valueKey(draft) !== valueKey(entries)) onCommit(draft)
    setSession(null)
  }

  const visible = useMemo(
    () => entries.slice(0, options.summaryRows),
    [entries, options.summaryRows],
  )
  const labelOf = useEntryLabels(visible, options, nodeAddress)
  const more = entries.length - visible.length
  const addLabel = configuredLabel(options.addLabel, t('addEntry', 'Add entry'))

  return (
    <div className="bese-summary" data-invalid={invalid || undefined}>
      {visible.length > 0 && (
        <ul className="bese-summary-list">
          {visible.map((entry, index) => (
            <li key={entry._id}>
              <button
                type="button"
                className="bese-summary-row"
                onClick={() => open(index)}
              >
                <RowText label={labelOf(entry, index)} />
              </button>
            </li>
          ))}
          {more > 0 && (
            <li className="bese-summary-more">
              {t('summary.more', '+{0} more', [more])}
            </li>
          )}
        </ul>
      )}
      <div className="bese-summary-footer">
        <span className="bese-summary-count">
          {entries.length === 0
            ? t('summary.empty', 'No entries yet')
            : tp('summary.count', entries.length, ['{0} entry', '{0} entries'])}
        </span>
        <Button id={id} variant="outline" size="sm" onClick={() => open()}>
          <Icon name={entries.length === 0 ? 'plus' : 'pen'} size="s" />
          {entries.length === 0 ? addLabel : t('edit', 'Edit')}
        </Button>
      </div>
      {session && (
        <EntriesDialog
          open={!picking}
          title={configuredLabel(options.dialogTitle, subject.label)}
          size={options.dialogSize}
          fields={options.fields}
          labelOptions={options}
          addLabel={addLabel}
          nodeAddress={nodeAddress}
          draft={session.draft}
          stored={entries}
          selectedId={session.selectedId}
          revision={session.revision}
          dirty={valueKey(session.draft) !== session.initialKey}
          conflict={storedKey !== session.baseKey}
          onDraftChange={(update) =>
            setSession((current) => current && { ...current, draft: update(current.draft) })
          }
          onSelect={(selectedId) =>
            setSession((current) => current && { ...current, selectedId })
          }
          onKeepMine={() =>
            setSession((current) => current && { ...current, baseKey: storedKey })
          }
          onLoadTheirs={() =>
            setSession((current) => {
              if (!current) return current
              return {
                draft: entries,
                selectedId: entries.some((entry) => entry._id === current.selectedId)
                  ? current.selectedId
                  : (entries[0]?._id ?? null),
                baseKey: storedKey,
                initialKey: valueKey(entries),
                revision: current.revision + 1,
              }
            })
          }
          onApply={apply}
          onClose={() => setSession(null)}
        />
      )}
    </div>
  )
}

