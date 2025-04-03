#!/bin/bash

# main dependencies
bunx gitpick@latest https://github.com/sindresorhus/terminal-link/blob/1fa2892d27f388ea1cf9a2c934470fc94dda2115/index.js external/terminal-link -f
bunx gitpick@latest https://github.com/sindresorhus/nano-spawn/tree/d3d724082c6bc679079e150b25b5b8242a2af2c4/source external/nano-spawn -f

# dependencies of main dependencies
bunx gitpick@latest https://github.com/sindresorhus/ansi-escapes/blob/300a0dfab1715ddc540dec2dec76082be69a99c8/base.js external/ansi-escapes -f
bunx gitpick@latest https://github.com/sindresorhus/ansi-escapes/blob/300a0dfab1715ddc540dec2dec76082be69a99c8/index.js external/ansi-escapes -f
bunx gitpick@latest https://github.com/chalk/supports-hyperlinks/blob/c5d1720b5ccc8b8f3d6e97c6ea9bf42a3d69820f/index.js external/supports-hyperlinks -f

# sub dependencies
bunx gitpick@latest https://github.com/chalk/supports-color/blob/ae809ecabd5965d0685e7fc121efe98c47ad8724/index.js external/supports-color -f
bunx gitpick@latest https://github.com/sindresorhus/environment/blob/0e664a280bbbb4569458b25d175eb745a5cb4d29/index.js external/environment -f
bunx gitpick@latest https://github.com/sindresorhus/has-flag/blob/0c7d032214c51d14b458364c9f6575ea9afa08b1/index.js external/has-flag -f

bunx prettier@latest --write --ignore-unknown "external"

# terminal-link is dependent on ansi-escapes and supports-hyperlinks
sed -i "" "s|from 'ansi-escapes'|from '../ansi-escapes'|g" external/terminal-link/index.js
sed -i "" "s|from 'environment'|from '../environment'|g" external/ansi-escapes/base.js
sed -i "" "s|from 'supports-hyperlinks'|from '../supports-hyperlinks'|g" external/terminal-link/index.js
sed -i "" "s|from 'supports-color'|from '../supports-color'|g" external/supports-hyperlinks/index.js
sed -i "" "s|from 'has-flag'|from '../has-flag'|g" external/supports-hyperlinks/index.js
