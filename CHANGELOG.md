# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- References to nodes as entry fields: `type: reference` or `references`
  (or Studio's `ReferenceEditor` / `ReferencesEditor`) store the target's
  node aggregate id as a plain string or a list of ids, not as a Neos graph
  reference. A stored id that no longer resolves shows as missing and is
  kept until another node is picked or it is removed.
- The `LinkEditor` is supported as an entry field, with its `editorOptions`
  (`assets`, `nodeTypes`, `placeholder`).
- `labelValues: raw` shows values as stored in row labels and the summary,
  as before.

### Changed

- Row labels and the inspector summary show values as their editors show
  them: a select box's option label, a checked box's field label, a date in
  the field's format, a link's page or asset title, a reference's target
  label. Rows of existing lists read differently. A row pointing at a
  removed page or asset reads "Missing" there and gets a warning icon.
- Requires Neos Studio 2.10 (`medienreaktor/neos-studio` `^2.10`).

## [1.1.0] - 2026-11-25

### Changed

- Errors of a new entry show once a field was edited or Apply was tried, not
  right after adding it. Clicking the disabled Apply button shows all errors
  and goes to the first invalid field. Stored entries still show their errors
  right away.

## [1.0.0] - 2026-11-13

### Added

- The entries editor for Neos Studio, `Beromir.EntriesEditor/Editor`: a list
  of entries stored in one `array` property, edited in a dialog built from
  Studio's own property editors (text field, text area, select box, boolean
  and plugin editors such as the IconSelectEditor and the ToggleEditor).
- Every entry carries a generated `_id` that survives reordering. Keys that
  are not configured as fields are kept.
- An inspector summary with the first entries, "+N more", the number of
  entries and an Edit button.
- A dialog with the entries on the left and the selected entry's fields on
  the right, in the sizes `lg`, `xl` (default) and `full`. Edits stay in a
  draft: Apply saves the list as one change, Cancel discards it and asks
  first when there are changes.
- Reordering by drag and drop, with move up/down buttons and with
  Alt+Up/Alt+Down; Up and Down move between entries.
- Field validation with Studio's validators: errors show under the field and
  as a dot on the entry, and keep Apply disabled.
- A notice with "Load theirs" and "Keep mine" when someone else saves the
  list while the dialog is open.
- Row labels from `labelTemplate`, new entries from each field's
  `defaultValue`, and field and option labels as plain text or translation
  ids.
- English and German labels.

[Unreleased]: https://github.com/beromir/Beromir.NeosStudio.EntriesEditor/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/beromir/Beromir.NeosStudio.EntriesEditor/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/beromir/Beromir.NeosStudio.EntriesEditor/releases/tag/v1.0.0
