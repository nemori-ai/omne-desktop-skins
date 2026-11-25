# contract

`omne-contract.json` is a snapshot of what the OMNE desktop client accepts from a skin: the `--omne-*` tokens, the
parts and the layers each opens (`tokens`, `style`, `render`), the icon names of `shell.icon` and the pieces of
`shell.piece`. `source` names the omne-harness-lite commit it was read from.

It is generated; do not edit it by hand:

```sh
npm run sync-contract -- --source /path/to/omne-harness-lite
```

With a client connected, `OmneExtensionPoints show shell.tokens` (and the other points) gives the live lists; if
they differ from the snapshot, the snapshot is out of date.
