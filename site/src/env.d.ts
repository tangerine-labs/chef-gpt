declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
/** The site base with trailing slash (`/chef-gpt/`), from vite.config.ts. */
declare const __SITE_BASE__: string;
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
