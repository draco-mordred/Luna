import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { createClient, type Provider, type Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

export const getSupabaseClient = () => supabase;

export async function signInWithOAuth(provider: Provider): Promise<void> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add the project URL and public client key to .env.local.'
    );
  }

  const usesDeepLink = Boolean(window.electronAPI) || Capacitor.isNativePlatform();
  const redirectTo = usesDeepLink
    ? 'luna-auth://callback'
    : `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw error;
  if (!data.url) throw new Error(`Supabase did not return an authorization URL for ${provider}.`);

  if (window.electronAPI) {
    await window.electronAPI.openAuthUrl(data.url);
  } else if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: data.url });
  } else {
    window.location.assign(data.url);
  }
}

export async function handleOAuthCallback(url: string): Promise<Session | null> {
  const callback = new URL(url);
  if (callback.protocol !== 'luna-auth:' || callback.hostname !== 'callback') return null;
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add the project URL and public client key to .env.local.'
    );
  }

  const providerError =
    callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (providerError) throw new Error(providerError);

  const code = callback.searchParams.get('code');
  if (!code) throw new Error('The sign-in callback did not include an authorization code.');

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) {
    throw new Error('Supabase accepted the callback but did not return a signed-in session.');
  }
  return data.session;
}

export async function addNativeOAuthCallbackListener(
  callback: (url: string) => void
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  let lastCallbackUrl: string | null = null;
  const dispatchCallback = (url: string) => {
    if (url === lastCallbackUrl) return;
    lastCallbackUrl = url;
    callback(url);
  };
  const listener = await App.addListener('appUrlOpen', ({ url }) => dispatchCallback(url));
  try {
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) dispatchCallback(launchUrl.url);
  } catch (error) {
    await listener.remove();
    throw error;
  }
  return () => {
    void listener.remove();
  };
}
