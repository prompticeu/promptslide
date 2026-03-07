# Changelog

## [0.3.5](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.4...promptslide-v0.3.5) (2026-03-07)


### Features

* persist deck and item metadata to lockfile for publish defaults ([#68](https://github.com/prompticeu/promptslide/issues/68)) ([0dc8ca3](https://github.com/prompticeu/promptslide/commit/0dc8ca3f52b86214eb42dacd9e1ead4d05928242))

## [0.3.4](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.3...promptslide-v0.3.4) (2026-03-07)


### Features

* unify deckPrefix and deckSlug into single deck slug concept ([#66](https://github.com/prompticeu/promptslide/issues/66)) ([f091c7d](https://github.com/prompticeu/promptslide/commit/f091c7dcd93738670fde4b48ff1020a358bce128))


### Performance Improvements

* optimize deck publish with parallel phases and reusable capture session ([#63](https://github.com/prompticeu/promptslide/issues/63)) ([62fb985](https://github.com/prompticeu/promptslide/commit/62fb9853f7d220be8bf5ba07e5cc55744b658229))

## [0.3.3](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.2...promptslide-v0.3.3) (2026-03-07)


### Features

* forward browser ESM import errors to terminal logs ([#61](https://github.com/prompticeu/promptslide/issues/61)) ([4925013](https://github.com/prompticeu/promptslide/commit/49250131469061b4ca102644e8a7cbf6f63ac2c9))

## [0.3.2](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.1...promptslide-v0.3.2) (2026-03-07)


### Bug Fixes

* correct package.json path resolution in CLI commands ([#59](https://github.com/prompticeu/promptslide/issues/59)) ([a79e81d](https://github.com/prompticeu/promptslide/commit/a79e81dab73606494cf334121bcbff52273d038c))

## [0.3.1](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.0...promptslide-v0.3.1) (2026-03-07)


### Features

* **cli:** track promptslide version on publish and warn on add ([#58](https://github.com/prompticeu/promptslide/issues/58)) ([503e1f0](https://github.com/prompticeu/promptslide/commit/503e1f0bdac8066fb047b001c4b07c7ff6d87b23))


### Bug Fixes

* hoist deckBaseSlug to fix ReferenceError in publish command ([#56](https://github.com/prompticeu/promptslide/issues/56)) ([dd29c36](https://github.com/prompticeu/promptslide/commit/dd29c36ecd862d2e52844933478cb8ef652c0c23))
* include CHANGELOG.md in published npm packages ([#53](https://github.com/prompticeu/promptslide/issues/53)) ([8a38a55](https://github.com/prompticeu/promptslide/commit/8a38a5533b0ea41593eba901551b0815e9da0515))

## [0.3.0](https://github.com/prompticeu/promptslide/compare/promptslide-v0.2.6...promptslide-v0.3.0) (2026-03-07)


### ⚠ BREAKING CHANGES

* move SlideFooter from core to user-land layouts ([#47](https://github.com/prompticeu/promptslide/issues/47))

### Features

* add theme system and reusable slide layouts ([#8](https://github.com/prompticeu/promptslide/issues/8)) ([b107f35](https://github.com/prompticeu/promptslide/commit/b107f35bb9bcc4edf9b171f5947e5e1d0ad8eb2a))
* **cli:** add --yes flag for non-interactive project scaffolding ([#21](https://github.com/prompticeu/promptslide/issues/21)) ([88d233f](https://github.com/prompticeu/promptslide/commit/88d233fc6f8cc970e4a13f1876cb5a2f06dd13b9))
* **cli:** add lockfile integrity with file hashing and tracking ([4c6238a](https://github.com/prompticeu/promptslide/commit/4c6238ad6e0cee85e3b918b4a120450262fedb7b))
* **cli:** add org management, preview image generation, and registry improvements ([a5d36eb](https://github.com/prompticeu/promptslide/commit/a5d36eb8d6dc6098f8bba2746aae711da16461fa))
* **cli:** add registry commands with lockfile integrity and file hashing ([72ba46e](https://github.com/prompticeu/promptslide/commit/72ba46eff408a28132b6318c0f7b78e7b6b203fe))
* **cli:** add SlideEmbed and /embed route ([#44](https://github.com/prompticeu/promptslide/issues/44)) ([3014ff8](https://github.com/prompticeu/promptslide/commit/3014ff8fdae6b1bbf8807c00f8c7410a78eff529))
* merge promptslide-core into promptslide package ([9248ed2](https://github.com/prompticeu/promptslide/commit/9248ed21d4a9d075d9246dd4b2892aa21c41eb0a))
* move SlideFooter from core to user-land layouts ([#47](https://github.com/prompticeu/promptslide/issues/47)) ([8beae61](https://github.com/prompticeu/promptslide/commit/8beae615f299d3601eedf9faabba38ae7b3ccf81))
* persist publish slug and add promptslide pull ([#45](https://github.com/prompticeu/promptslide/issues/45)) ([c6b3781](https://github.com/prompticeu/promptslide/commit/c6b37810c272d0ee62223d0362e09d7bb1d37eac))
* **registry:** add registry cli funcs ([cb3cc2e](https://github.com/prompticeu/promptslide/commit/cb3cc2eca14d9bfe17c24050e066102f83ae093c))
* show URL after publishing deck or slides ([#46](https://github.com/prompticeu/promptslide/issues/46)) ([25d9791](https://github.com/prompticeu/promptslide/commit/25d97914bb0d666e36756b851cd05fd69fe98a14))


### Bug Fixes

* add Windows support for browser open in login command ([3ac57bc](https://github.com/prompticeu/promptslide/commit/3ac57bc375e841a2ef711c1f040f6230b6f2870d))
* address PR review feedback — arg parsing, import path, and lockfile bugs ([9087a7e](https://github.com/prompticeu/promptslide/commit/9087a7ec001bab05544f401673af0b043d49e90c))
* build promptslide package and add development exports ([#12](https://github.com/prompticeu/promptslide/issues/12)) ([2e60766](https://github.com/prompticeu/promptslide/commit/2e60766bb41f3a72775bae196d4d7e89bd08897a))
* CLI security hardening and bug fixes ([52fa1af](https://github.com/prompticeu/promptslide/commit/52fa1af3b4392cdfbd5d673e7a7a9d43ac2db26c))
* grid view and studio broken by stale file: paths ([#43](https://github.com/prompticeu/promptslide/issues/43)) ([3f5c548](https://github.com/prompticeu/promptslide/commit/3f5c54892e05c5a12e6c7b6f473745e0e7adc8f1))
* prevent directory argument from being filtered out in create command ([#40](https://github.com/prompticeu/promptslide/issues/40)) ([c1ff8f5](https://github.com/prompticeu/promptslide/commit/c1ff8f5779f0e1687b0064f107ab8d64c753c35f))
* remove leftover optional chaining on storedFiles in update command ([ed10b3f](https://github.com/prompticeu/promptslide/commit/ed10b3fae1e761deee9b4d046b1af1c93c89cf4a))
* replace PROJECT_NAME placeholder in theme.ts during scaffolding ([#14](https://github.com/prompticeu/promptslide/issues/14)) ([62f03db](https://github.com/prompticeu/promptslide/commit/62f03db7da286562b574c91f406b800f145edafd))
* resolve all linting errors in CLI commands ([#50](https://github.com/prompticeu/promptslide/issues/50)) ([8e2a5e8](https://github.com/prompticeu/promptslide/commit/8e2a5e810786cb704e8b42e294bf695ca0e2f9dc))
* update default registry to promptslide.eu ([#35](https://github.com/prompticeu/promptslide/issues/35)) ([910dd62](https://github.com/prompticeu/promptslide/commit/910dd623c0b17786fe3fc8f15b4b8c94c2be80b6))
* vertically center content in SlideLayoutCentered layout ([#42](https://github.com/prompticeu/promptslide/issues/42)) ([f53851e](https://github.com/prompticeu/promptslide/commit/f53851ec4cab60b697a186d01f01c8cc6bd7d781))
