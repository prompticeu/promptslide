# Changelog

## [0.3.15](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.14...promptslide-v0.3.15) (2026-04-09)


### Bug Fixes

* normalize paths to forward slashes for Windows compatibility ([#99](https://github.com/prompticeu/promptslide/issues/99)) ([4148895](https://github.com/prompticeu/promptslide/commit/414889594e7839172a19c547e1cbb04127bfe55e))
* remove slide title from navigation controls ([#97](https://github.com/prompticeu/promptslide/issues/97)) ([2e2c011](https://github.com/prompticeu/promptslide/commit/2e2c0115a8488c9bc6c903971998211283148692))

## [0.3.14](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.13...promptslide-v0.3.14) (2026-04-01)


### Features

* add optional white glow PNG for slide backgrounds ([#94](https://github.com/prompticeu/promptslide/issues/94)) ([cbd500e](https://github.com/prompticeu/promptslide/commit/cbd500e8bdb1f3125bdbad6668d924394d6245a2))
* add workflow hint to annotation sidebar ([#92](https://github.com/prompticeu/promptslide/issues/92)) ([0d898d6](https://github.com/prompticeu/promptslide/commit/0d898d66e90a767bf6187103d3fb7a24dfc7d828))


### Bug Fixes

* allow arrow key navigation in fullscreen when annotation mode is active ([#95](https://github.com/prompticeu/promptslide/issues/95)) ([b2f8d31](https://github.com/prompticeu/promptslide/commit/b2f8d3150d24b919303de8126f6460c0123bfd29))

## [0.3.13](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.12...promptslide-v0.3.13) (2026-03-29)


### Bug Fixes

* pin dependency versions and preserve component names in publish pipeline ([#89](https://github.com/prompticeu/promptslide/issues/89)) ([22b7dcb](https://github.com/prompticeu/promptslide/commit/22b7dcbe33c9852fac2fbfef70943254a0d871cd))

## [0.3.12](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.11...promptslide-v0.3.12) (2026-03-28)


### Features

* add clone command, make create --from always template ([#87](https://github.com/prompticeu/promptslide/issues/87)) ([769fa7e](https://github.com/prompticeu/promptslide/commit/769fa7ed0ee77f7473f49f2eb608ca996142f3fd))

## [0.3.11](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.10...promptslide-v0.3.11) (2026-03-25)


### Bug Fixes

* **cli:** embed body margin reset and Math.min scaling ([7eb75ef](https://github.com/prompticeu/promptslide/commit/7eb75ef4e93eda2eeba23394ae50713eea0e55f0))

## [0.3.10](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.9...promptslide-v0.3.10) (2026-03-25)


### Bug Fixes

* **slide-embed:** scale slides to cover viewport ([9f07aed](https://github.com/prompticeu/promptslide/commit/9f07aedec92fb6531f101c108144b16e78e746af))

## [0.3.9](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.8...promptslide-v0.3.9) (2026-03-24)


### Bug Fixes

* preserve component name casing through publish/pull roundtrip ([a34e83a](https://github.com/prompticeu/promptslide/commit/a34e83a7b3869ef7487b361bba23fd4cce72a0b6))
* preserve component name casing through publish/pull roundtrip ([e04d96c](https://github.com/prompticeu/promptslide/commit/e04d96c7367b69f8aff2f97c4a29a56a610a3c78))

## [0.3.8](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.7...promptslide-v0.3.8) (2026-03-23)


### Bug Fixes

* include layouts and theme in deck registryDependencies ([#81](https://github.com/prompticeu/promptslide/issues/81)) ([4dbd699](https://github.com/prompticeu/promptslide/commit/4dbd699480d692625cf65dd32c556cfe62fc529a))
* sanitize deck slug from lockfile to match validation rules ([#79](https://github.com/prompticeu/promptslide/issues/79)) ([8692313](https://github.com/prompticeu/promptslide/commit/869231362e9485d3f177ca5337d3a5ff92743f47))

## [0.3.7](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.6...promptslide-v0.3.7) (2026-03-19)


### Features

* add slide annotation system with persistent storage and pull export ([#78](https://github.com/prompticeu/promptslide/issues/78)) ([c4addbb](https://github.com/prompticeu/promptslide/commit/c4addbba10f53eede84b0c3e1f3f2704a8a7125b))
* always check registry for publish overwrite scenarios ([#77](https://github.com/prompticeu/promptslide/issues/77)) ([bef4af5](https://github.com/prompticeu/promptslide/commit/bef4af51d397af50baa7ba038fbdf647e0ac5f56))
* scaffold lockfile with auto-generated publish metadata ([#75](https://github.com/prompticeu/promptslide/issues/75)) ([bc3a7bd](https://github.com/prompticeu/promptslide/commit/bc3a7bd7a6c2871f27e874b12b21978911fe91e0))

## [0.3.6](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.5...promptslide-v0.3.6) (2026-03-11)


### Features

* show organization hint in publish command ([#73](https://github.com/prompticeu/promptslide/issues/73)) ([3002f25](https://github.com/prompticeu/promptslide/commit/3002f255f386a5bf646381808324ebda96c57707))

## [0.3.5](https://github.com/prompticeu/promptslide/compare/promptslide-v0.3.4...promptslide-v0.3.5) (2026-03-08)


### Features

* bundle shared sources with deck publish and fix deck-config parsing ([5f7fd1d](https://github.com/prompticeu/promptslide/commit/5f7fd1de6e5fc58a0568bd87830094dd40c9eca7))
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
