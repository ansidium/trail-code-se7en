/** Keep upgrades and agent wiring on the Delphi-capable fork. */
export const FORK_PACKAGE = "trail-code-se7en";
export const FORK_INSTALL = "github:ansidium/trail-code-se7en";
/**
 * The one command that installs or upgrades the fork for good, in any shell.
 * Never `npm install -g ${FORK_INSTALL}`: npm can't build a git package inside
 * a global install (see installFork in cli-meta.ts).
 */
export const FORK_SETUP = `npx -y --package ${FORK_INSTALL} trail upgrade`;
