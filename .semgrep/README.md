# Frappe Semgrep rules (vendored)

These are the static-analysis rules from
[frappe/frappe-semgrep-rules](https://github.com/frappe/frappe-semgrep-rules),
vendored here so they run as part of the xpos `pre-commit` gate without
depending on network access or an upstream tag (the upstream repo ships no
`.pre-commit-hooks.yaml` and is not tagged).

Wired into [`.pre-commit-config.yaml`](../../.pre-commit-config.yaml) as the
`frappe-semgrep` hook.

## Run manually

```bash
semgrep --config .semgrep/frappe-rules --error xpos frontend/src
```

## Updating

```bash
git clone --depth 1 https://github.com/frappe/frappe-semgrep-rules /tmp/fsr
cp /tmp/fsr/rules/*.yml .semgrep/frappe-rules/
cp /tmp/fsr/rules/security/*.yml .semgrep/frappe-rules/security/
semgrep --validate --config .semgrep/frappe-rules
```

Only the `*.yml` rule files are vendored; upstream `.py`/`.js` files are
semgrep test fixtures (intentionally vulnerable) and are deliberately omitted.
