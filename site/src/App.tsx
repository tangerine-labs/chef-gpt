import type { Session } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import css from "./auth.module.css";
import {
  authorizationId,
  clearPendingInvite,
  forgetAuthorizationId,
  pendingInvite,
  returnUrl,
  setPendingInvite,
  supabase,
} from "./supabase.ts";

type Details = { clientName: string; clientUri: string | null; scopes: string[] };

type State =
  | { kind: "loading" }
  | { kind: "no-request"; joined?: string }
  | { kind: "sign-in"; id: string; error?: string }
  | { kind: "check-email"; email: string }
  | { kind: "consent"; id: string; details: Details; error?: string; busy: boolean; joined?: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const id = authorizationId();
    // supabase-js finishes any `?code=` exchange on load; wait for the session to settle.
    supabase.auth.getSession().then(({ data: { session } }) => start(id, session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") start(id, session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Redeem a pending invite once signed in; returns the joined household's name. */
  async function redeemInvite(session: Session | null): Promise<string | undefined> {
    const code = pendingInvite();
    if (!code || !session) return undefined;
    const { data, error } = await supabase.rpc("join_household", { invite_code: code });
    clearPendingInvite();
    if (error) {
      console.warn("join_household:", error.message);
      return undefined;
    }
    return (data as { household_name: string }[] | null)?.[0]?.household_name;
  }

  async function start(id: string | null, session: Session | null) {
    const joined = await redeemInvite(session);
    if (!id) return setState({ kind: "no-request", joined });
    if (!session) return setState({ kind: "sign-in", id });
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error || !data) {
      forgetAuthorizationId();
      return setState({ kind: "sign-in", id, error: error?.message ?? "Could not load the request." });
    }
    if ("redirect_url" in data && typeof data.redirect_url === "string") {
      location.href = data.redirect_url; // already consented earlier
      return;
    }
    const d = data as { client?: { name?: string; uri?: string | null }; scope?: string };
    setState({
      kind: "consent",
      id,
      busy: false,
      joined,
      details: {
        clientName: d.client?.name || "the application",
        clientUri: d.client?.uri ?? null,
        scopes: (d.scope ?? "").split(" ").filter(Boolean),
      },
    });
  }

  async function google(id: string) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: returnUrl(id) },
    });
    if (error) setState({ kind: "sign-in", id, error: error.message });
  }

  async function magicLink(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: returnUrl(id) },
    });
    setState(error ? { kind: "sign-in", id, error: error.message } : { kind: "check-email", email });
  }

  async function decide(approve: boolean) {
    if (state.kind !== "consent") return;
    setState({ ...state, busy: true, error: undefined });
    const { error } = approve
      ? await supabase.auth.oauth.approveAuthorization(state.id)
      : await supabase.auth.oauth.denyAuthorization(state.id);
    if (error) setState({ ...state, busy: false, error: error.message });
    else forgetAuthorizationId(); // the SDK redirects the browser back to the MCP client
  }

  return (
    <main className={css.main}>
      <div className={css.card}>
        {state.kind === "loading" && <p className={css.sub}>Loading…</p>}

        {state.kind === "no-request" && (
          <>
            <h1 className={css.title}>chef-gpt</h1>
            <p className={css.sub}>
              Nothing to approve here. Add chef-gpt as a connector in your chat app and it will bring you back
              to this page to sign in.
            </p>
          </>
        )}

        {state.kind === "sign-in" && (
          <>
            <h1 className={css.title}>Sign in to chef-gpt</h1>
            <p className={css.sub}>Your household's dinners, plans and shopping list.</p>
            <button type="button" className={css.btn} onClick={() => google(state.id)}>
              <GoogleIcon /> Continue with Google
            </button>
            <p className={css.or}>or get a magic link</p>
            <form className={css.form} onSubmit={(e) => magicLink(state.id, e)}>
              <input className={css.input} type="email" name="email" placeholder="you@example.com" required />
              <button className={`${css.btn} ${css.primary}`} type="submit">
                Email me a link
              </button>
            </form>
            <p className={css.or}>Joining someone's household?</p>
            <input
              className={css.input}
              type="text"
              placeholder="Invite code, e.g. ABCD-1234"
              defaultValue={pendingInvite() ?? ""}
              autoCapitalize="characters"
              onChange={(e) => {
                const v = e.currentTarget.value.trim();
                if (v) setPendingInvite(v);
                else clearPendingInvite();
              }}
            />
            <p className={css.err}>{state.error ?? ""}</p>
          </>
        )}

        {state.kind === "check-email" && (
          <>
            <h1 className={css.title}>Check your email</h1>
            <p className={css.sub}>
              We sent a sign-in link to <b>{state.email}</b>. Open it in this browser to continue.
            </p>
          </>
        )}

        {state.kind === "consent" && (
          <>
            <h1 className={css.title}>Authorize {state.details.clientName}</h1>
            {state.joined && <p className={css.sub}>You've joined {state.joined}. 🎉</p>}
            <p className={css.sub}>This app wants to use chef-gpt on your behalf.</p>
            <div className={css.box}>
              <b>Application</b>
              <span>{state.details.clientName}</span>
            </div>
            {state.details.clientUri && (
              <div className={css.box}>
                <b>Website</b>
                <span>{state.details.clientUri}</span>
              </div>
            )}
            {state.details.scopes.length > 0 && (
              <div className={css.box}>
                <b>Requested permissions</b>
                <span>{state.details.scopes.join(", ")}</span>
              </div>
            )}
            <div className={css.row}>
              <button
                type="button"
                className={`${css.btn} ${css.primary}`}
                disabled={state.busy}
                onClick={() => decide(true)}
              >
                Approve
              </button>
              <button type="button" className={css.btn} disabled={state.busy} onClick={() => decide(false)}>
                Deny
              </button>
            </div>
            <p className={css.err}>{state.error ?? ""}</p>
          </>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
