# Beromir.NeosStudio.EntriesEditor

The entries editor for **Neos Studio** (`Medienreaktor.NeosStudio`). It edits
a list of entries - say an icon, a heading and a text, many times over - in
one `array` property, instead of a content collection with child nodes.

The inspector shows a short summary of the list. Editing happens in a dialog:
the entries on the left, the selected entry's fields on the right. Each field
is rendered by a registered Studio property editor (text field, text area,
select box, boolean, or a plugin's editor such as the
[IconSelectEditor](https://github.com/beromir/Beromir.NeosStudio.IconSelectEditor)
or the [ToggleEditor](https://github.com/beromir/Beromir.NeosStudio.ToggleEditor)).
Changes stay in a draft until **Apply**; **Cancel** discards them.

## Installation

Requires Neos Studio 2.1 or later (`medienreaktor/neos-studio` `^2.1`) with
Neos `^9.2` and PHP `^8.4`.

Run the following command in your site package:

```bash
composer require --no-update beromir/neos-studio-entries-editor
```

Then run `composer update` in your project root and flush the Flow caches.
The package adds its labels to the backend translations; if they show up in
English only, flush the XLIFF cache once:

```bash
./flow flow:cache:flushone Neos_Neos_XliffToJsonTranslations
```

## Usage

```yaml
'Vendor.Site:Content.FeatureList':
  superTypes:
    'Neos.Neos:Content': true
  properties:
    features:
      type: array
      ui:
        label: 'Features'
        reloadIfChanged: true
        inspector:
          group: 'general'
          editor: 'Beromir.EntriesEditor/Editor'
          editorOptions:
            dialogTitle: 'Vendor.Site:NodeTypes.Content.FeatureList:features'
            labelTemplate: '{heading}'
            addLabel: 'Add feature'
            fields:
              icon:
                label: 'Icon'
                editor: 'Medienreaktor.IconSelectEditor/Editor'
                editorOptions:
                  iconSources: ['icons']
              heading:
                label: 'Heading'
                validation:
                  'Neos.Neos/Validation/NotEmptyValidator': []
              text:
                label: 'Text'
                editor: 'Neos.Neos/Inspector/Editors/TextAreaEditor'
              highlight:
                type: boolean
                label: 'Highlight'
                defaultValue: false
```

### Editor options

| Option          | Default                 | Description |
| --------------- | ----------------------- | ----------- |
| `fields`        | -                       | The fields of one entry, keyed by name, in display order (see below). |
| `labelTemplate` | `'{<first field>}'`     | The row label, with `{field}` placeholders, e.g. `'{heading} – {subline}'`. Values are shown as stored (a select box shows its value, not its option label). Rows whose placeholders are all empty read "Entry 3". |
| `dialogTitle`   | the property label      | Plain text or a translation id (`Package:Source:id`). |
| `dialogSize`    | `xl`                    | `lg`, `xl` or `full`. |
| `addLabel`      | "Add entry"             | Plain text or a translation id. |
| `summaryRows`   | `3`                     | How many entries the inspector summary lists before "+N more". |

### Field options

| Option          | Default                       | Description |
| --------------- | ----------------------------- | ----------- |
| `label`         | the field name, humanized     | Plain text or a translation id (`Package:Source:id`). |
| `type`          | `string`                      | Handed to the editor as `subject.type`; also picks the default editor (`string`, `integer`: text field, `boolean`: checkbox, `array`: select box). |
| `editor`        | by `type`                     | Any registered Studio property editor id. |
| `editorOptions` | `{}`                          | Passed to that editor, as for a node property. |
| `validation`    | `{}`                          | Validators as for a node property, e.g. `'Neos.Neos/Validation/StringLengthValidator': {maximum: 80}`. Every entry is validated on each change and Apply stays disabled until all are valid. Errors show under the field and mark the row once the field was edited or left, or Apply was tried; stored entries show theirs right away. |
| `defaultValue`  | -                             | The value a new entry starts with. |

Supported in v1 are editors that store plain values: `TextFieldEditor`,
`TextAreaEditor`, `SelectBoxEditor`, `BooleanEditor` and plugin editors such
as the IconSelectEditor and the ToggleEditor. Not supported:

- `ImageEditor`, `AssetEditor`, `LinkEditor`: an `array` property is stored as
  plain JSON, so an image is kept as `{"id": "<uuid>"}` and is neither
  resolved to an asset in Fusion nor counted as an asset usage.
- `ReferenceEditor`, `ReferencesEditor`: they read their value from the
  node's references, not from the field.

To limit how many entries a list may have, use a validator on the property
itself, e.g. `'Neos.Neos/Validation/CountValidator': {minimum: 1, maximum: 6}`.

## Editing

The inspector lists the first entries (see `summaryRows`) and the number of
entries. Click an entry or **Edit** to open the dialog:

- **Add** appends an entry that starts with each field's `defaultValue`. An
  empty list opens with one new entry; Apply saves it even when left as is.
- Reorder entries by dragging them, with the arrow buttons above the form,
  or with Alt+Up and Alt+Down on a focused entry. Up and Down move between
  entries, Enter or a click selects one and focuses its first field.
- **Duplicate** copies the selected entry with a new `_id`, **Delete**
  removes it.
- **Apply** saves the whole list as one change; without changes it only
  closes the dialog. **Cancel**, Escape and the close button discard the
  draft, asking first when it has changes.

## Stored value

The property holds an array of objects. Every entry has a generated `_id`
that stays the same when entries are reordered, so it can also serve as a
stable anchor or key in your markup:

```json
[
  {"_id": "3f0c…", "icon": "icons:bolt", "heading": "Fast", "text": "…", "highlight": false},
  {"_id": "9a41…", "icon": "icons:lock", "heading": "Secure", "text": "…", "highlight": true}
]
```

Keys that are not (or no longer) configured as fields are kept when an entry
is edited, so renaming a field in the node type never deletes content. Move
existing values to the new name with a node migration.

## Rendering

```fusion
prototype(Vendor.Site:Content.FeatureList) < prototype(Neos.Neos:ContentComponent) {
    features = ${q(node).property('features') || []}

    renderer = afx`
        <ul>
            <Neos.Fusion:Loop items={props.features}>
                <li>
                    <Neos.Fusion:Template @if={item.icon} templatePath={IconSelect.resourceUri(item.icon)} />
                    <h3>{item.heading}</h3>
                    <p>{item.text}</p>
                </li>
            </Neos.Fusion:Loop>
        </ul>
    `
}
```

## Conflicts

In a collaborative (shared) workspace, Studio keeps the property's stored
value up to date while the dialog is open. If someone else saves the same
list in the meantime, the dialog shows a notice and Apply waits until you
choose **Load theirs** (replaces your draft) or **Keep mine** (your draft
overwrites their change on Apply).

## Development

The Studio plugin lives in `Resources/Private/Plugin` and is built into
`Resources/Public/Plugin`:

```bash
cd Resources/Private/Plugin
npm install
npm run build   # or: npm run dev
npm test
```

## License

GPL-3.0-or-later, see [LICENSE](LICENSE).
