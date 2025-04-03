#!/bin/bash

bunx gitpick@latest https://github.com/sindresorhus/nano-spawn/tree/d3d724082c6bc679079e150b25b5b8242a2af2c4/source external/nano-spawn -f
bunx prettier@latest --write --ignore-unknown "external"
