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
  touchEntries,
  touchField,
  validateEntries,
  valueKey,
  visibleErrors,
  type EntryErrors,
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
