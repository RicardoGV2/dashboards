# Storage

IndexedDB adapter for the current document and preceding snapshot. Saves resolve on transaction completion. The web shell serializes writes and holds a Web Lock to prevent another tab from overwriting autosaves. Loading failure disables autosave. Manual JSON export is the portable backup path. Recovery UI, cross-device sync, migrations and pending-close handling remain future work.
