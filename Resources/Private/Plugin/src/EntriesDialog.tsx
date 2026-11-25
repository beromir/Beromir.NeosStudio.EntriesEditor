import {
  Component,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  editors,
  Field,
  Icon,
  Placeholder,
  validators,
  type NodeAddress,
} from '@medienreaktor/neos-studio'
import {
  copyTouched,
  createEntry,
  dropTouched,
  duplicateEntry,
  firstInvalid,
  humanize,
  moveItem,
  neighbourAfterRemoval,
  touchEntries,
  touchField,
  validateEntries,
  valueKey,
  visibleErrors,
  type DialogSize,
  type Entry,
  type FieldConfig,
  type TouchedFields,
  type ValidatorLookup,
} from './entries'
import { configuredLabel, rowLabel, t, tp } from './i18n'

const lookupValidator: ValidatorLookup = (id) => validators.get(id)?.validate

interface EntriesDialogProps {
  open: boolean
  title: string
  size: DialogSize
  fields: FieldConfig[]
  labelTemplate: string | undefined
  addLabel: string
  nodeAddress: NodeAddress | undefined
  draft: Entry[]
  /** The stored entries: those in the draft count as touched. */
  stored: Entry[]
  selectedId: string | null
  revision: number
  dirty: boolean
  conflict: boolean
  onDraftChange: (update: (draft: Entry[]) => Entry[]) => void
  onSelect: (id: string | null) => void
  onKeepMine: () => void
  onLoadTheirs: () => void
  onApply: (draft: Entry[]) => void
  onClose: () => void
}

export function EntriesDialog({
  open,
  title,
  size,
  fields,
  labelTemplate,
  addLabel,
  nodeAddress,
  draft,
  stored,
  selectedId,
  revision,
  dirty,
  conflict,
  onDraftChange,
  onSelect,
  onKeepMine,
  onLoadTheirs,
  onApply,
  onClose,
}: EntriesDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // The order at drag start, restored when the drag ends without a drop on the list.
  const dragOrigin = useRef<Entry[] | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const emptyAddRef = useRef<HTMLDivElement>(null)
  // A data-focus-key to focus once the action's render is committed: many actions
  // unmount, move or disable the focused control, which drops focus to the dialog.
  // 'form' is the selected entry's first field, else the empty list's add button.
  const focusRequest = useRef<string | null>(null)
  // Stored entries count as touched, so stored invalid data is flagged right away.
  const touchStored = () => touchEntries({}, stored.map((entry) => entry._id))
  const [touched, setTouched] = useState<TouchedFields>(touchStored)

  const firstField = () => focusableIn(formRef.current)

  // Every action that requests focus also changes state, so a render follows.
  useLayoutEffect(() => {
    const key = focusRequest.current
    if (key === null) return
    focusRequest.current = null
    const element =
      key === 'form'
        ? (firstField() ?? emptyAddRef.current?.querySelector('button'))
        : document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)
    // A field's key marks its wrapper; focus goes to the editor's control inside.
    const target = element?.matches(FOCUSABLE) ? element : focusableIn(element)
    target?.focus()
  })

  const select = (id: string | null) => {
    focusRequest.current = 'form'
    onSelect(id)
  }

  const focusRow = (index: number) =>
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>('.bese-row-button')
      [index]?.focus()

  // At either end the move button disables itself, so focus goes to its counterpart.
  const moveSelected = (by: -1 | 1) => {
    const to = selectedIndex + by
    if (to === 0) focusRequest.current = 'move-down'
    if (to === draft.length - 1) focusRequest.current = 'move-up'
    move(selectedIndex, to)
  }

  const errors = useMemo(
    () => validateEntries(draft, fields, lookupValidator),
    [draft, fields],
  )
  const shown = useMemo(() => visibleErrors(errors, touched), [errors, touched])
  const invalid = draft.some((entry) => errors[entry._id])
  const shownCount = draft.filter((entry) => shown[entry._id]).length
  const selectedIndex = draft.findIndex((entry) => entry._id === selectedId)
  const selected = selectedIndex === -1 ? null : draft[selectedIndex]

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  const add = () => {
    const entry = createEntry(fields)
    onDraftChange((current) => [...current, entry])
    select(entry._id)
  }

  const move = (from: number, to: number) =>
    onDraftChange((current) => moveItem(current, from, to))

  const duplicate = (id: string) => {
    const [next, copyId] = duplicateEntry(draft, id)
    onDraftChange(() => next)
    if (copyId !== null) setTouched((current) => copyTouched(current, id, copyId))
    select(copyId)
  }

  const remove = (id: string) => {
    const next = neighbourAfterRemoval(draft, id)
    if (next === null) focusRequest.current = 'form'
    onSelect(next)
    onDraftChange((current) => current.filter((entry) => entry._id !== id))
    setTouched((current) => dropTouched(current, id))
  }

  const touch = (id: string, field: string) =>
    setTouched((current) => touchField(current, id, field))

  const setFieldValue = (entry: Entry, field: string, value: unknown) => {
    // Some editors report their value without a change (on mount, say), which is no edit.
    if (valueKey(value) !== valueKey(entry[field])) touch(entry._id, field)
    onDraftChange((current) =>
      current.map((item) => (item._id === entry._id ? { ...item, [field]: value } : item)),
    )
  }

  // Apply stays disabled while an entry is invalid; trying it anyway reveals every error
  // and takes the editor to the first one.
  const attemptApply = () => {
    setTouched((current) => touchEntries(current, draft.map((entry) => entry._id)))
    const target = firstInvalid(draft, fields, errors, selectedId)
    if (!target) return
    focusRequest.current = `field:${target.field}`
    if (target.id !== selectedId) onSelect(target.id)
  }

  const labelOf = (entry: Entry, index: number) => rowLabel(entry, index, labelTemplate, fields)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        size={size}
        className={`bese-dialog bese-dialog--${size}`}
        initialFocus={() => firstField() ?? true}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {conflict && (
          <div className="bese-conflict" role="alert">
            <Icon name="triangle-exclamation" />
            <span className="bese-conflict-text">
              {t(
                'conflict.message',
                'Someone else changed this list while you were editing it.',
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                focusRequest.current = 'form'
                setTouched(touchStored())
                onLoadTheirs()
              }}
            >
              {t('conflict.loadTheirs', 'Load theirs')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                focusRequest.current = 'apply'
                onKeepMine()
              }}
            >
              {t('conflict.keepMine', 'Keep mine')}
            </Button>
          </div>
        )}

        {draft.length === 0 ? (
          <div ref={emptyAddRef}>
            <Placeholder icon="fa-list" title={t('dialog.empty', 'No entries yet.')}>
              <Button variant="outline" size="sm" onClick={add}>
                <Icon name="plus" size="s" />
                {addLabel}
              </Button>
            </Placeholder>
          </div>
        ) : (
          <div className="bese-layout">
            <div className="bese-list-column">
              <ul
                className="bese-list"
                aria-label={title}
                ref={listRef}
                // On the list rather than the rows, so a drop between two rows counts too.
                onDragOver={(event) => dragIndex !== null && event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  dragOrigin.current = null
                }}
              >
                {draft.map((entry, index) => (
                  <li
                    key={entry._id}
                    className="bese-row"
                    data-selected={entry._id === selectedId || undefined}
                    data-dragging={index === dragIndex || undefined}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      // Firefox only starts a drag once dataTransfer carries something. A private
                      // type, so text fields and the address bar don't take the drag as text.
                      event.dataTransfer.setData('application/x-beromir-entry', entry._id)
                      dragOrigin.current = draft
                      setDragIndex(index)
                    }}
                    onDragOver={() => {
                      if (dragIndex === null || dragIndex === index) return
                      move(dragIndex, index)
                      setDragIndex(index)
                    }}
                    onDragEnd={() => {
                      const origin = dragOrigin.current
                      if (origin) onDraftChange(() => origin)
                      dragOrigin.current = null
                      setDragIndex(null)
                    }}
                  >
                    <Icon name="grip-vertical" className="bese-grip" />
                    <button
                      type="button"
                      className="bese-row-button"
                      aria-current={entry._id === selectedId || undefined}
                      data-focus-key={`row:${entry._id}`}
                      onClick={() => select(entry._id)}
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                        event.preventDefault()
                        const to = index + (event.key === 'ArrowUp' ? -1 : 1)
                        if (!event.altKey) {
                          focusRow(to)
                          return
                        }
                        if (to < 0 || to >= draft.length) return
                        // React reorders by re-inserting a row, which blurs it if it is the focused one.
                        focusRequest.current = `row:${entry._id}`
                        move(index, to)
                      }}
                    >
                      <span className="bese-row-label">{labelOf(entry, index)}</span>
                      {shown[entry._id] && (
                        <span
                          className="bese-row-error"
                          role="img"
                          aria-label={t('entryInvalid', 'This entry has errors')}
                          title={t('entryInvalid', 'This entry has errors')}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" className="bese-add" onClick={add}>
                <Icon name="plus" size="s" />
                {addLabel}
              </Button>
            </div>

            <div className="bese-form-column">
              {selected && (
                <>
                  <div className="bese-toolbar">
                    <span className="bese-toolbar-title">
                      {labelOf(selected, selectedIndex)}
                    </span>
                    <ToolbarButton
                      focusKey="move-up"
                      icon="arrow-up"
                      label={t('moveUp', 'Move up')}
                      disabled={selectedIndex === 0}
                      onClick={() => moveSelected(-1)}
                    />
                    <ToolbarButton
                      focusKey="move-down"
                      icon="arrow-down"
                      label={t('moveDown', 'Move down')}
                      disabled={selectedIndex === draft.length - 1}
                      onClick={() => moveSelected(1)}
                    />
                    <ToolbarButton
                      icon="copy"
                      label={t('duplicate', 'Duplicate')}
                      onClick={() => duplicate(selected._id)}
                    />
                    <ToolbarButton
                      icon="trash"
                      label={t('delete', 'Delete')}
                      onClick={() => remove(selected._id)}
                    />
                  </div>
                  <div className="bese-form" key={`${selected._id}:${revision}`} ref={formRef}>
                    {fields.map((field) => (
                      <EntryField
                        key={field.name}
                        field={field}
                        value={selected[field.name]}
                        errors={shown[selected._id]?.[field.name] ?? []}
                        nodeAddress={nodeAddress}
                        onValue={(value) => setFieldValue(selected, field.name, value)}
                        onTouch={() => touch(selected._id, field.name)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="bese-footer">
          {shownCount > 0 && (
            <span className="bese-footer-errors">
              {tp('invalidEntries', shownCount, [
                '{0} entry has errors',
                '{0} entries have errors',
              ])}
            </span>
          )}
          <Button variant="outline" onClick={requestClose}>
            {t('cancel', 'Cancel')}
          </Button>
          {/* A disabled button takes no pointer events, so a click on it lands here. */}
          <span
            className="bese-apply"
            onClick={() => invalid && !conflict && attemptApply()}
          >
            <Button
              data-focus-key="apply"
              disabled={invalid || conflict}
              onClick={() => onApply(draft)}
            >
              {t('apply', 'Apply')}
            </Button>
          </span>
        </DialogFooter>

        <ConfirmDialog
          open={confirmDiscard}
          title={t('discard.title', 'Discard changes?')}
          description={t(
            'discard.description',
            'Your changes to this list have not been applied.',
          )}
          confirmLabel={t('discard.confirm', 'Discard')}
          onOpenChange={setConfirmDiscard}
          onConfirm={() => {
            setConfirmDiscard(false)
            onClose()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ToolbarButton({
  focusKey,
  icon,
  label,
  disabled,
  onClick,
}: {
  focusKey?: string
  icon: string
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      data-focus-key={focusKey}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </Button>
  )
}

function EntryField({
  field,
  value,
  errors,
  nodeAddress,
  onValue,
  onTouch,
}: {
  field: FieldConfig
  value: unknown
  errors: string[]
  nodeAddress: NodeAddress | undefined
  onValue: (value: unknown) => void
  onTouch: () => void
}) {
  const id = useId()
  // Popups such as a select box's list are portalled out of the field, but their events
  // still bubble here through React: a blur only counts when no refocus follows. Focus the
  // dialog moved here itself (a new entry's first field) is not left by the editor.
  const pendingBlur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const used = useRef(false)
  const focusHandlers = {
    onPointerDown: () => (used.current = true),
    onKeyDown: () => (used.current = true),
    onFocus: () => clearTimeout(pendingBlur.current),
    onBlur: () => {
      clearTimeout(pendingBlur.current)
      if (used.current) pendingBlur.current = setTimeout(onTouch)
    },
  }
  const definition = editors.getDefinition(field.editor)
  const label = configuredLabel(field.label, humanize(field.name))
  const errorLines =
    errors.length > 0 ? (
      <div role="alert" className="bese-errors">
        {errors.map((error, index) => (
          <p key={index}>{error}</p>
        ))}
      </div>
    ) : null

  if (!definition) {
    return (
      <div className="bese-field" data-focus-key={`field:${field.name}`}>
        <Field label={label}>
          <div className="bese-notice">
            {t('editorMissing', 'Editor not available: {0}', [field.editor])}
          </div>
        </Field>
      </div>
    )
  }

  const Editor = definition.component
  const control = (
    <FieldBoundary editor={field.editor}>
      <Editor
        subject={{ name: field.name, type: field.type, label }}
        id={id}
        value={value}
        options={field.editorOptions}
        nodeAddress={nodeAddress}
        invalid={errors.length > 0}
        // The draft takes live values too, so Apply never misses a value still being typed.
        onChange={onValue}
        onCommit={onValue}
      />
    </FieldBoundary>
  )

  return (
    <div className="bese-field" data-focus-key={`field:${field.name}`} {...focusHandlers}>
      {definition.rendersOwnLabel ? (
        control
      ) : (
        <Field label={label} htmlFor={id}>
          {control}
        </Field>
      )}
      {errorLines}
    </div>
  )
}

const FOCUSABLE =
  'input, textarea, select, button, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

function focusableIn(root: HTMLElement | null | undefined): HTMLElement | null {
  return root?.querySelector<HTMLElement>(FOCUSABLE) ?? null
}

/** A crashing field editor (a plugin's, say) becomes a notice instead of taking the dialog down. */
class FieldBoundary extends Component<
  { editor: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`Editor "${this.props.editor}" crashed in an entry field:`, error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="bese-notice bese-notice--error">
          {t('editorFailed', 'This field could not be displayed.')}
        </div>
      )
    }
    return this.props.children
  }
}
