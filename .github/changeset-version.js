import { exec } from "node:child_process"

exec("npx changeset version")
exec("npm install")
