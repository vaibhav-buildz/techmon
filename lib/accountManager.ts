import { supabase } from "./supabase";

export interface SavedAccount {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  access_token: string;
  refresh_token: string;
}

const STORAGE_KEY = "techmon_saved_accounts";

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Error reading saved accounts:", err);
    return [];
  }
}

export function saveAccounts(accounts: SavedAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error("Error saving accounts:", err);
  }
}

export function addAccount(session: any, profile?: { name?: string; avatar_url?: string } | null): void {
  if (!session?.user) return;
  
  const user = session.user;
  const accounts = getSavedAccounts();
  const existingIdx = accounts.findIndex((a) => a.user_id === user.id);
  
  const name = profile?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Unknown User";
  const avatar_url = profile?.avatar_url || user.user_metadata?.avatar_url || "";
  
  const newAccount: SavedAccount = {
    user_id: user.id,
    email: user.email || "",
    name,
    avatar_url,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
  
  if (existingIdx > -1) {
    // Update existing account session/metadata
    accounts[existingIdx] = {
      ...accounts[existingIdx],
      ...newAccount,
      // Keep old name/avatar if new one is not available
      name: name !== "Unknown User" ? name : accounts[existingIdx].name,
      avatar_url: avatar_url || accounts[existingIdx].avatar_url,
    };
  } else {
    accounts.push(newAccount);
  }
  
  saveAccounts(accounts);
}

export function removeAccount(user_id: string): void {
  const accounts = getSavedAccounts();
  const updated = accounts.filter((a) => a.user_id !== user_id);
  saveAccounts(updated);
}

export async function switchToAccount(user_id: string): Promise<SavedAccount> {
  const accounts = getSavedAccounts();
  const account = accounts.find((a) => a.user_id === user_id);
  if (!account) {
    throw new Error("Account not found in saved list.");
  }
  
  // Set session in Supabase
  const { data, error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });
  
  if (error || !data.session) {
    // If setting session fails (e.g. refresh token expired), remove it and throw
    removeAccount(user_id);
    throw new Error(error?.message || "Failed to set session. Session may have expired.");
  }
  
  // Update the tokens in our saved list since setSession may have refreshed them
  addAccount(data.session, {
    name: account.name,
    avatar_url: account.avatar_url,
  });
  
  return account;
}
