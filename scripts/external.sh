#!/bin/bash

# main dependencies
bunx gitpick@latest https://github.com/sindresorhus/nano-spawn/tree/38da67877bec96474757282468f1754958aa3bab/source external/nano-spawn -f
bunx gitpick@latest https://github.com/sindresorhus/strip-json-comments/blob/7355ba42e0ad6e5cd27cc984add85355df50fa34/index.js external/strip-json-comments -f
bunx gitpick@latest https://github.com/sindresorhus/terminal-link/blob/975358c3b5bb99d0f9ac07ff51f692883358f6ab/index.js external/terminal-link -f
bunx gitpick@latest https://github.com/sindresorhus/yocto-spinner/blob/966be5ddf0bdaac85474258ec79b401f4e733085/index.js external/yocto-spinner -f
bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/ab9da8d65ff69b6dc107cfc048e3769d3a450de4/base.js external/yoctocolors -f
bunx gitpick@latest https://github.com/sindresorhus/yoctocolors/blob/ab9da8d65ff69b6dc107cfc048e3769d3a450de4/index.js external/yoctocolors -f

# sub dependencies
bunx gitpick@latest https://github.com/chalk/supports-color/blob/47d3c56c15368ca0d892fb0e5ebed68afcc08e35/index.js external/supports-color -f
bunx gitpick@latest https://github.com/chalk/supports-hyperlinks/blob/0ddff155059f59db1a76edd51003dc01e33793fd/index.js external/supports-hyperlinks -f
bunx gitpick@latest https://github.com/sindresorhus/ansi-escapes/blob/73e652efe7a353bdf25f456e592c858e4648db3d/base.js external/ansi-escapes -f
bunx gitpick@latest https://github.com/sindresorhus/ansi-escapes/blob/73e652efe7a353bdf25f456e592c858e4648db3d/index.js external/ansi-escapes -f
bunx gitpick@latest https://github.com/sindresorhus/environment/blob/0e664a280bbbb4569458b25d175eb745a5cb4d29/index.js external/environment -f
bunx gitpick@latest https://github.com/sindresorhus/has-flag/blob/0c7d032214c51d14b458364c9f6575ea9afa08b1/index.js external/has-flag -f

bunx oxfmt@latest external/

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i "" 's|from "ansi-escapes"|from "../ansi-escapes"|g' external/terminal-link/index.js
  sed -i "" 's|from "environment"|from "../environment"|g' external/ansi-escapes/base.js
  sed -i "" 's|from "has-flag"|from "../has-flag"|g' external/supports-hyperlinks/index.js
  sed -i "" 's|from "supports-color"|from "../supports-color"|g' external/supports-hyperlinks/index.js
  sed -i "" 's|from "supports-hyperlinks"|from "../supports-hyperlinks"|g' external/terminal-link/index.js
  sed -i "" 's|from "yoctocolors"|from "../yoctocolors"|g' external/yocto-spinner/index.js
else
  sed -i 's|from "ansi-escapes"|from "../ansi-escapes"|g' external/terminal-link/index.js
  sed -i 's|from "environment"|from "../environment"|g' external/ansi-escapes/base.js
  sed -i 's|from "has-flag"|from "../has-flag"|g' external/supports-hyperlinks/index.js
  sed -i 's|from "supports-color"|from "../supports-color"|g' external/supports-hyperlinks/index.js
  sed -i 's|from "supports-hyperlinks"|from "../supports-hyperlinks"|g' external/terminal-link/index.js
  sed -i 's|from "yoctocolors"|from "../yoctocolors"|g' external/yocto-spinner/index.js
fi
