[![make.fun · news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/0xrifai/makefun-news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/0xrifai/makefun-news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

# The World in One Image — 20 November 2026

Entry for the [make.fun bounty news-image-20261120](https://make.fun/bounty/news-image-20261120): sum up Friday 20 November 2026's world news in a single image.

`main.ts` (Node 22+, stdlib only, offline, deterministic) draws a 1024×1024 PNG front page with a hand-coded 5×7 pixel font and a hand-rolled PNG encoder. No photos, no external assets, no network — every graphic is drawn in code.

## The five stories

1. **Myanmar guilty of genocide** — the International Court of Justice ruled Myanmar committed genocide against the Rohingya in its 2017 crackdown, in the first-ever state genocide verdict (9–6), ordering reparations and the safe return of those who fled.
2. **Three leaders, one declaration** — Trump, Xi and Putin met in Shenzhen and signed a four-point peace pledge on the UN, energy and nuclear risk, with no word on Ukraine or Iran.
3. **Missile hits Riyadh tower** — a Houthi missile damaged the PIF Tower, Riyadh's tallest skyscraper, blowing out windows across eight floors; no injuries were reported.
4. **Kyiv bridges hit overnight** — Russian missiles and drones struck three bridges in Kyiv overnight, killing three people and knocking out power.
5. **AI rally turns to rout** — Anthropic made a record $81 billion Nasdaq debut, then shares slid; the Nikkei fell about 4% and the S&P 500 dropped for a sixth straight day.

## Run it

```sh
node main.ts
# writes entry.png to $MAKEFUN_OUTPUT_DIR (default /output)
```

Two runs produce byte-identical output (verified with sha256).
