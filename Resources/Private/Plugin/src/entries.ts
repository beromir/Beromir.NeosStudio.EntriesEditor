export interface Entry {
  _id: string
  [key: string]: unknown
}

export interface FieldConfig {
  name: string
  /** As configured: plain text or a "Package:Source:id" translation id; undefined when not set. */
  label: string | undefined
  type: string
  editor: string
  editorOptions: Record<string, unknown>
  validation: Record<string, unknown>
  defaultValue: unknown
}

export type DialogSize = 'lg' | 'xl' | 'full'

/** How row labels show values: as their editors show them, or as stored. */
export type LabelValues = 'formatted' | 'raw'

export interface EntriesOptions {
  fields: FieldConfig[]
  labelTemplate: string | undefined
  dialogTitle: string | undefined
  dialogSize: DialogSize
  addLabel: string | undefined
  summaryRows: number
  labelValues: LabelValues
}

// Mirrors Studio's own type defaults (Neos.Neos.userInterface.inspector.dataTypes)
// for the types an entry field can sensibly have.
const DATA_TYPE_EDITORS: Record<string, string> = {
  string: 'Neos.Neos/Inspector/Editors/TextFieldEditor',
  integer: 'Neos.Neos/Inspector/Editors/TextFieldEditor',
  boolean: 'Neos.Neos/Inspector/Editors/BooleanEditor',
  array: 'Neos.Neos/Inspector/Editors/SelectBoxEditor',
  DateTime: 'Neos.Neos/Inspector/Editors/DateTimeEditor',
  reference: 'Neos.Neos/Inspector/Editors/ReferenceEditor',
  references: 'Neos.Neos/Inspector/Editors/ReferencesEditor',
}

// An entry stores a reference as the target's id. The reference editors only edit
// graph references for these subject types, so the field gets the plain type instead.
const VALUE_TYPES: Record<string, string> = {
  reference: 'string',
  references: 'array',
}

const DIALOG_SIZES: DialogSize[] = ['lg', 'xl', 'full']

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseFields(raw: unknown): FieldConfig[] {
  if (!isRecord(raw)) return []
  const fields: FieldConfig[] = []
  for (const [name, config] of Object.entries(raw)) {
    // `_id` is the entry's own key; a field must not overwrite it.
    if (name === '_id' || !isRecord(config)) continue
    const configured = typeof config.type === 'string' ? config.type : 'string'
    fields.push({
      name,
      label: typeof config.label === 'string' ? config.label : undefined,
      type: VALUE_TYPES[configured] ?? configured,
      editor:
        typeof config.editor === 'string'
          ? config.editor
          : (DATA_TYPE_EDITORS[configured] ?? DATA_TYPE_EDITORS.string),
      editorOptions: isRecord(config.editorOptions) ? config.editorOptions : {},
      validation: isRecord(config.validation) ? config.validation : {},
      defaultValue: config.defaultValue,
    })
  }
  return fields
}

export function parseOptions(options: Record<string, unknown>): EntriesOptions {
  const summaryRows = Number(options.summaryRows)
  return {
    fields: parseFields(options.fields),
    labelTemplate:
      typeof options.labelTemplate === 'string' ? options.labelTemplate : undefined,
    dialogTitle:
      typeof options.dialogTitle === 'string' ? options.dialogTitle : undefined,
    dialogSize: DIALOG_SIZES.includes(options.dialogSize as DialogSize)
      ? (options.dialogSize as DialogSize)
      : 'xl',
    addLabel: typeof options.addLabel === 'string' ? options.addLabel : undefined,
    summaryRows:
      Number.isInteger(summaryRows) && summaryRows >= 0 ? summaryRows : 3,
    labelValues: options.labelValues === 'raw' ? 'raw' : 'formatted',
  }
}

export function createId(): string {
  // randomUUID needs a secure context; a plain-http dev host has none.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The stored value as entries. Non-object items cannot be edited with fields
 * and are dropped; entries without an `_id` (hand-written or migrated data)
 * get one, keeping all other keys.
 */
export function normalizeEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.filter(isRecord).map((item) => {
    let id = typeof item._id === 'string' && item._id !== '' ? item._id : createId()
    if (seen.has(id)) id = createId()
    seen.add(id)
    return { ...item, _id: id }
  })
}

export function createEntry(fields: FieldConfig[]): Entry {
  const entry: Entry = { _id: createId() }
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      entry[field.name] = structuredClone(field.defaultValue)
    }
  }
  return entry
}

export function duplicateEntry(entries: Entry[], id: string): [Entry[], string | null] {
  const index = entries.findIndex((entry) => entry._id === id)
  if (index === -1) return [entries, null]
  const copy: Entry = { ...structuredClone(entries[index]), _id: createId() }
  return [[...entries.slice(0, index + 1), copy, ...entries.slice(index + 1)], copy._id]
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** The entry to select after removing `id`: the next one, else the previous one. */
export function neighbourAfterRemoval(entries: Entry[], id: string): string | null {
  const index = entries.findIndex((entry) => entry._id === id)
  if (index === -1) return null
  return entries[index + 1]?._id ?? entries[index - 1]?._id ?? null
}

function placeholderText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
      .join(', ')
  }
  return ''
}

const PLACEHOLDER = /\{([^{}]+)\}/g

function effectiveTemplate(template: string | undefined, fields: FieldConfig[]): string {
  return template ?? (fields[0] ? `{${fields[0].name}}` : '')
}

/** The entry keys a label template reads, each once, in template order. */
export function templateKeys(template: string | undefined, fields: FieldConfig[]): string[] {
  const keys = [...effectiveTemplate(template, fields).matchAll(PLACEHOLDER)].map((match) =>
    match[1].trim(),
  )
  return [...new Set(keys)]
}

/** A value as its editor shows it (Studio's FormattedValue). */
export interface ShownValue {
  label: string
  missing?: boolean
}

/**
 * What a placeholder shows for a value: its label once resolved (null: nothing
 * to show), undefined while it is still resolving - the stored value shows then.
 */
export type ShownValueLookup = (key: string, value: unknown) => ShownValue | null | undefined

export interface EntryLabel {
  /** null when every placeholder is empty, so the caller can fall back to "Entry n". */
  label: string | null
  /** A value in the label points at something that no longer resolves. */
  missing: boolean
}

/**
 * The row label from a '{field}' template. Without a template the first
 * field labels the row. Without `shown`, values show as stored.
 */
export function resolveEntryLabel(
  entry: Entry,
  template: string | undefined,
  fields: FieldConfig[],
  shown?: ShownValueLookup,
): EntryLabel {
  let filled = false
  let missing = false
  const label = effectiveTemplate(template, fields).replace(PLACEHOLDER, (_, raw: string) => {
    const key = raw.trim()
    const value = entry[key]
    const formatted = shown?.(key, value)
    if (formatted?.missing) missing = true
    const text = (formatted === undefined ? placeholderText(value) : (formatted?.label ?? ''))
      // Rich text or textarea content in a one-line label.
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text !== '') filled = true
    return text
  })
  return { label: filled ? label.trim() : null, missing }
}

/** The row label with values as stored; null when every placeholder is empty. */
export function entryLabel(
  entry: Entry,
  template: string | undefined,
  fields: FieldConfig[],
): string | null {
  return resolveEntryLabel(entry, template, fields).label
}

export type ValidatorLookup = (
  id: string,
) => ((value: unknown, options: Record<string, unknown>) => string | null) | undefined

/** The same contract as the inspector's validateValue: unknown or throwing validators are skipped. */
export function validateValue(
  value: unknown,
  validation: Record<string, unknown>,
  lookup: ValidatorLookup,
): string[] {
  const errors: string[] = []
  for (const [id, rawOptions] of Object.entries(validation)) {
    const validate = lookup(id)
    if (!validate) continue
    try {
      const error = validate(value, isRecord(rawOptions) ? rawOptions : {})
      if (error !== null) errors.push(error)
    } catch (thrown) {
      console.error(`Validator "${id}" threw and was skipped:`, thrown)
    }
  }
  return errors
}

/** Errors per entry id and field name; entries without errors are absent. */
export type EntryErrors = Record<string, Record<string, string[]>>

export function validateEntries(
  entries: Entry[],
  fields: FieldConfig[],
  lookup: ValidatorLookup,
): EntryErrors {
  const result: EntryErrors = {}
  for (const entry of entries) {
    for (const field of fields) {
      const errors = validateValue(entry[field.name], field.validation, lookup)
      if (errors.length === 0) continue
      result[entry._id] ??= {}
      result[entry._id][field.name] = errors
    }
  }
  return result
}

/** Per entry id, the fields the editor has touched; `true` counts every field as touched. */
export type TouchedFields = Record<string, true | string[]>

export function touchEntries(touched: TouchedFields, ids: string[]): TouchedFields {
  const next = { ...touched }
  for (const id of ids) next[id] = true
  return next
}

export function touchField(touched: TouchedFields, id: string, field: string): TouchedFields {
  const current = touched[id]
  if (current === true || current?.includes(field)) return touched
  return { ...touched, [id]: [...(current ?? []), field] }
}

export function copyTouched(touched: TouchedFields, from: string, to: string): TouchedFields {
  // Touched lists are never mutated, so the copy can share the source's.
  return from in touched ? { ...touched, [to]: touched[from] } : touched
}

export function dropTouched(touched: TouchedFields, id: string): TouchedFields {
  const { [id]: _, ...rest } = touched
  return rest
}

/** The errors to show: only those of touched fields. */
export function visibleErrors(errors: EntryErrors, touched: TouchedFields): EntryErrors {
  const result: EntryErrors = {}
  for (const [id, fieldErrors] of Object.entries(errors)) {
    const entryTouched = touched[id]
    if (entryTouched === undefined) continue
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (entryTouched !== true && !entryTouched.includes(field)) continue
      result[id] ??= {}
      result[id][field] = messages
    }
  }
  return result
}

/** The first invalid field in list and field order, starting with `preferId` when it is invalid. */
export function firstInvalid(
  entries: Entry[],
  fields: FieldConfig[],
  errors: EntryErrors,
  preferId: string | null = null,
): { id: string; field: string } | null {
  const ids =
    preferId !== null && errors[preferId]
      ? [preferId]
      : entries.map((entry) => entry._id).filter((id) => errors[id])
  for (const id of ids) {
    const field = fields.find((candidate) => errors[id]?.[candidate.name])
    if (field) return { id, field: field.name }
  }
  return null
}

/** A stable comparison key for stored values, independent of object key order. */
export function valueKey(value: unknown): string {
  return JSON.stringify(value ?? null, (_, item: unknown) =>
    isRecord(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  )
}

export function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function isTranslationId(label: string): boolean {
  return /^[\w.]+:[\w.]+:[\w.-]+$/.test(label)
}
