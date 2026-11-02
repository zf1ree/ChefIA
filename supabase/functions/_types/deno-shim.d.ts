// Tipos mínimos do runtime Deno para checar as Edge Functions com `tsc`
// (npm run typecheck:functions). Não é enviado no deploy.
declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
}
