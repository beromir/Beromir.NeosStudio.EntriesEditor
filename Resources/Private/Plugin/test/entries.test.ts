import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  copyTouched,
  createEntry,
  dropTouched,
  duplicateEntry,
  entryLabel,
  firstInvalid,
  isTranslationId,
  moveItem,
  neighbourAfterRemoval,
  normalizeEntries,
  parseFields,
  parseOptions,
  resolveEntryLabel,
  templateKeys,
  touchEntries,
  touchField,
  validateEntries,
  valueKey,
  visibleErrors,
  type EntryErrors,
  type ShownValue,
  type ValidatorLookup,
} from '../src/entries.ts'

const fields = parseFields({
  icon: { editor: 'Medienreaktor.IconSelectEditor/Editor' },
  heading: {
    label: 'Heading',
    defaultValue: 'New',
    validation: { 'Neos.Neos/Validation/NotEmptyValidator': [] },
  },
  visible: { type: 'boolean', defaultValue: true },
  _id: { label: 'not a field' },
})

test('parseFields keeps declaration order, defaults editors by type and skips _id', () => {
  assert.deepEqual(
    fields.map((field) => [field.name, field.editor]),
    [
      ['icon', 'Medienreaktor.IconSelectEditor/Editor'],
      ['heading', 'Neos.Neos/Inspector/Editors/TextFieldEditor'],
      ['visible', 'Neos.Neos/Inspector/Editors/BooleanEditor'],
    ],
  )
})

test('parseOptions falls back for invalid sizes and row counts', () => {
  const options = parseOptions({ dialogSize: 'huge', summaryRows: -1 })
  assert.equal(options.dialogSize, 'xl')
  assert.equal(options.summaryRows, 3)
  assert.equal(parseOptions({ dialogSize: 'full', summaryRows: 0 }).summaryRows, 0)
})

test('parseOptions shows formatted values unless labelValues is raw', () => {
  assert.equal(parseOptions({}).labelValues, 'formatted')
  assert.equal(parseOptions({ labelValues: 'raw' }).labelValues, 'raw')
  assert.equal(parseOptions({ labelValues: 'other' }).labelValues, 'formatted')
})

test('normalizeEntries keeps unknown keys, adds missing and duplicate ids, drops non-objects', () => {
  const entries = normalizeEntries([
    { _id: 'a', heading: 'A', legacy: 1 },
    { heading: 'B' },
    { _id: 'a', heading: 'C' },
    'stray',
  ])
  assert.equal(entries.length, 3)
  assert.deepEqual(entries[0], { _id: 'a', heading: 'A', legacy: 1 })
  assert.ok(entries[1]._id && entries[1]._id !== 'a')
  assert.ok(entries[2]._id !== 'a')
  assert.deepEqual(normalizeEntries(null), [])
})

test('createEntry applies default values as copies', () => {
  const entry = createEntry(fields)
  assert.equal(entry.heading, 'New')
  assert.equal(entry.visible, true)
  assert.ok(!('icon' in entry))
})

test('duplicateEntry inserts a copy with a new id below the original', () => {
  const [next, copyId] = duplicateEntry(
    [{ _id: 'a', heading: 'A' }, { _id: 'b', heading: 'B' }],
    'a',
  )
  assert.deepEqual(next.map((entry) => entry.heading), ['A', 'A', 'B'])
  assert.equal(next[1]._id, copyId)
  assert.notEqual(copyId, 'a')
})

test('moveItem and neighbourAfterRemoval', () => {
  assert.deepEqual(moveItem([1, 2, 3], 0, 2), [2, 3, 1])
  assert.deepEqual(moveItem([1, 2, 3], 0, 5), [1, 2, 3])
  const entries = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]
  assert.equal(neighbourAfterRemoval(entries, 'b'), 'c')
  assert.equal(neighbourAfterRemoval(entries, 'c'), 'b')
  assert.equal(neighbourAfterRemoval([{ _id: 'a' }], 'a'), null)
})

test('entryLabel fills placeholders and falls back when all are empty', () => {
  const entry = { _id: 'a', heading: 'Fast', text: '<p>Very\n fast</p>', tags: ['x', 'y'] }
  assert.equal(entryLabel(entry, '{heading} – {text}', fields), 'Fast – Very fast')
  assert.equal(entryLabel(entry, '{tags}', fields), 'x, y')
  assert.equal(entryLabel({ _id: 'b' }, '{heading} – {text}', fields), null)
  assert.equal(entryLabel({ _id: 'c', icon: 'icons:star.svg' }, undefined, fields), 'icons:star.svg')
})

test('validateEntries reports per entry and field, skipping unknown and throwing validators', () => {
  const lookup: ValidatorLookup = (id) =>
    id === 'Neos.Neos/Validation/NotEmptyValidator'
      ? (value) => (value ? null : 'This property is required.')
      : id === 'Vendor/Throws'
        ? () => {
            throw new Error('boom')
          }
        : undefined
  const withExtra = parseFields({
    heading: {
      validation: {
        'Neos.Neos/Validation/NotEmptyValidator': [],
        'Vendor/Unknown': {},
        'Vendor/Throws': {},
      },
    },
  })
  const originalError = console.error
  console.error = () => {}
  try {
    const errors = validateEntries(
      [{ _id: 'a', heading: 'ok' }, { _id: 'b', heading: '' }],
      withExtra,
      lookup,
    )
    assert.deepEqual(errors, { b: { heading: ['This property is required.'] } })
  } finally {
    console.error = originalError
  }
})

const required = parseFields({
  icon: { validation: { 'Neos.Neos/Validation/NotEmptyValidator': [] } },
  heading: { validation: { 'Neos.Neos/Validation/NotEmptyValidator': [] } },
})
const errors: EntryErrors = {
  a: { icon: ['required'], heading: ['required'] },
  b: { heading: ['required'] },
}

test('visibleErrors shows only errors of touched fields', () => {
  assert.deepEqual(visibleErrors(errors, {}), {})
  assert.deepEqual(visibleErrors(errors, { a: ['heading'], b: ['icon'] }), {
    a: { heading: ['required'] },
  })
  assert.deepEqual(visibleErrors(errors, { b: true }), { b: { heading: ['required'] } })
})

test('touchField adds a field once and keeps fully touched entries', () => {
  const once = touchField({}, 'a', 'icon')
  assert.deepEqual(once, { a: ['icon'] })
  assert.equal(touchField(once, 'a', 'icon'), once)
  assert.deepEqual(touchField(once, 'a', 'heading'), { a: ['icon', 'heading'] })
  const all = { a: true as const }
  assert.equal(touchField(all, 'a', 'icon'), all)
})

test('touchEntries marks every field of the given entries as touched', () => {
  assert.deepEqual(touchEntries({ a: ['icon'] }, ['a', 'b']), { a: true, b: true })
})

test('copyTouched copies the source state to a duplicate, dropTouched removes it', () => {
  const touched = { a: ['icon'] }
  const copied = copyTouched(touched, 'a', 'copy')
  assert.deepEqual(copied, { a: ['icon'], copy: ['icon'] })
  assert.deepEqual(copyTouched({ a: true }, 'a', 'copy'), { a: true, copy: true })
  assert.deepEqual(copyTouched({}, 'a', 'copy'), {})
  assert.deepEqual(dropTouched(copied, 'a'), { copy: ['icon'] })
  assert.deepEqual(dropTouched(touched, 'missing'), touched)
})

test('firstInvalid prefers the selected entry, else the first invalid in list order', () => {
  const entries = [{ _id: 'ok' }, { _id: 'b' }, { _id: 'a' }]
  assert.deepEqual(firstInvalid(entries, required, errors), { id: 'b', field: 'heading' })
  assert.deepEqual(firstInvalid(entries, required, errors, 'a'), { id: 'a', field: 'icon' })
  assert.deepEqual(firstInvalid(entries, required, errors, 'ok'), { id: 'b', field: 'heading' })
  assert.equal(firstInvalid(entries, required, {}), null)
})

test('valueKey ignores object key order', () => {
  assert.equal(valueKey([{ a: 1, b: 2 }]), valueKey([{ b: 2, a: 1 }]))
  assert.notEqual(valueKey([{ a: 1 }]), valueKey([{ a: 2 }]))
  assert.equal(valueKey(undefined), valueKey(null))
})

test('isTranslationId', () => {
  assert.ok(isTranslationId('Vendor.Site:NodeTypes.FeatureList:features'))
  assert.ok(!isTranslationId('Features: icon'))
  assert.ok(!isTranslationId('Features'))
})

test('templateKeys lists the keys a template reads, once each, or the first field', () => {
  assert.deepEqual(templateKeys('{heading} – { text } ({heading})', fields), ['heading', 'text'])
  assert.deepEqual(templateKeys(undefined, fields), ['icon'])
  assert.deepEqual(templateKeys(undefined, []), [])
})

const labelFields = parseFields({
  kind: { editor: 'Neos.Neos/Inspector/Editors/SelectBoxEditor' },
  link: { editor: 'Neos.Neos/Inspector/Editors/LinkEditor' },
  highlight: { type: 'boolean', label: 'Highlight' },
})

/** Stands in for Studio's formatters: labels by stored value, undefined while resolving. */
function lookupFrom(labels: Record<string, ShownValue | null>) {
  return (_key: string, value: unknown) =>
    typeof value === 'string' || typeof value === 'boolean'
      ? labels[String(value)]
      : undefined
}

test('resolveEntryLabel shows option labels instead of stored values', () => {
  const shown = lookupFrom({ fast: { label: 'Very fast' }, true: { label: 'Highlight' }, false: null })
  const entry = { _id: 'a', kind: 'fast', highlight: true }
  assert.deepEqual(resolveEntryLabel(entry, '{kind} · {highlight}', labelFields, shown), {
    label: 'Very fast · Highlight',
    missing: false,
  })
  // A false checkbox shows nothing, so an otherwise empty row falls back to "Entry n".
  assert.deepEqual(
    resolveEntryLabel({ _id: 'b', highlight: false }, '{highlight}', labelFields, shown),
    { label: null, missing: false },
  )
})

test('resolveEntryLabel shows the stored value while a label resolves, never an empty row', () => {
  const entry = { _id: 'a', link: 'node://3f0c6a1e-0000-4000-8000-000000000001' }
  assert.deepEqual(resolveEntryLabel(entry, '{link}', labelFields, () => undefined), {
    label: 'node://3f0c6a1e-0000-4000-8000-000000000001',
    missing: false,
  })
})

test('resolveEntryLabel shows link targets and flags ones that no longer resolve', () => {
  const shown = lookupFrom({
    'node://page': { label: 'About us' },
    'asset://file': { label: 'Price list.pdf' },
    'node://gone': { label: 'node://gone', missing: true },
    'https://example.com': { label: 'https://example.com' },
  })
  const label = (link: string) =>
    resolveEntryLabel({ _id: 'a', link }, '{link}', labelFields, shown)
  assert.deepEqual(label('node://page'), { label: 'About us', missing: false })
  assert.deepEqual(label('asset://file'), { label: 'Price list.pdf', missing: false })
  assert.deepEqual(label('https://example.com'), { label: 'https://example.com', missing: false })
  assert.deepEqual(label('node://gone'), { label: 'node://gone', missing: true })
})

test('resolveEntryLabel keeps raw values for keys without a formatted value', () => {
  const entry = { _id: 'a', kind: 'fast', legacy: 'kept' }
  assert.deepEqual(
    resolveEntryLabel(entry, '{kind} {legacy}', labelFields, (key) =>
      key === 'kind' ? { label: 'Very fast' } : undefined,
    ),
    { label: 'Very fast kept', missing: false },
  )
})

test('parseFields stores references as ids: the reference editors get a plain type', () => {
  const parsed = parseFields({
    location: { type: 'reference' },
    related: { type: 'references' },
    explicit: { type: 'reference', editor: 'Neos.Neos/Inspector/Editors/ReferenceEditor' },
    plain: { editor: 'Neos.Neos/Inspector/Editors/ReferenceEditor' },
  })
  assert.deepEqual(
    parsed.map((field) => [field.name, field.type, field.editor]),
    [
      ['location', 'string', 'Neos.Neos/Inspector/Editors/ReferenceEditor'],
      ['related', 'array', 'Neos.Neos/Inspector/Editors/ReferencesEditor'],
      ['explicit', 'string', 'Neos.Neos/Inspector/Editors/ReferenceEditor'],
      ['plain', 'string', 'Neos.Neos/Inspector/Editors/ReferenceEditor'],
    ],
  )
})
