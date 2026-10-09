import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  createClient.mockClear();
});

describe("configuration de la console", () => {
  it.each(["", "   ", "ceci-n-est-pas-une-url", "ftp://backend.example"])(
    "affiche un diagnostic au lieu de casser le module pour %j", async (url) => {
      vi.stubEnv("VITE_SUPABASE_URL", url);
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
      const module = await import("./supabaseClient");
      expect(module.supabaseConfigError).toMatch(/Configuration/);
      expect(createClient).toHaveBeenCalledWith("https://configuration-manquante.invalid", "cle-anon-manquante", expect.any(Object));
    },
  );

  it("normalise les espaces des variables de build", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", " https://api.example.test \n");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", " public-test-key ");
    const module = await import("./supabaseClient");
    expect(module.supabaseConfigError).toBeNull();
    expect(createClient).toHaveBeenCalledWith("https://api.example.test", "public-test-key", expect.any(Object));
  });
});
