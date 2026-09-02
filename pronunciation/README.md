# pronunciation

Standalone pronunciation-assessment CLI MVP. It takes a voice recording and
produces per-phoneme / word pronunciation feedback. This directory is **not** a
pnpm workspace package — it is a self-contained Python project with its own
`pytest.ini` and `src/`.

## Run

```bash
python main.py --audio voice-sample.wav
```

## Design

See `docs/specs/2026-05-30-pronunciation-module-design.md`.
