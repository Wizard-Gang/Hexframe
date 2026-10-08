import type { EdgeEnv } from "#wg-edge";

/** Public runtime bindings for the shared edge shell and static Training assets. */
export interface Env extends EdgeEnv {
  ASSETS: Fetcher;
}
