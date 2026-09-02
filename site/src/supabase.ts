/// <reference path="./env.d.ts" />
import { createClient } from "@supabase/supabase-js";

/** Browser client: PKCE sign-in, session in localStorage, `?code=` exchanged automatically. */
export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__);

const KEY = "chef-gpt:authorization_id";

/**
 * Supabase sends the browser here with `?authorization_id=…`. Google / magic-link round-trips
 * may drop the query string, so remember it for the duration of the tab.
 */
export function authorizationId(): string | null {
  const fromUrl = new URL(location.href).searchParams.get("authorization_id");
  if (fromUrl) {
    sessionStorage.setItem(KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(KEY);
}

export function forgetAuthorizationId() {
  sessionStorage.removeItem(KEY);
}

/** Where sign-in providers should send the browser back to: this page, carrying the id. */
export function returnUrl(id: string): string {
  const url = new URL(location.href);
  url.search = `?authorization_id=${encodeURIComponent(id)}`;
  url.hash = "";
  return url.toString();
}

const INVITE_KEY = "chef-gpt:invite";

/** An invite code from `?invite=` or typed on the sign-in page; redeemed once a session exists. */
export function pendingInvite(): string | null {
  const fromUrl = new URL(location.href).searchParams.get("invite");
  if (fromUrl) sessionStorage.setItem(INVITE_KEY, fromUrl);
  return sessionStorage.getItem(INVITE_KEY);
}
export function setPendingInvite(code: string) {
  sessionStorage.setItem(INVITE_KEY, code);
}
export function clearPendingInvite() {
  sessionStorage.removeItem(INVITE_KEY);
}
