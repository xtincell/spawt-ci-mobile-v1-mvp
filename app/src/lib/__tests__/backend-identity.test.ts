// Ce qui n'était vérifié nulle part : ce que le binaire porte réellement.
//
// La panne d'origine — code validé côté serveur, session refusée côté
// téléphone — venait d'une clé anonyme que la passerelle ne reconnaît pas. On
// ne pouvait ni la voir ni la nommer, parce que la résolution de la clé était
// recopiée dans quatre fichiers et n'était exposée par aucun.
//
// Ces tests couvrent la précédence des sources (le manifeste gagne sur le
// build), la distinction « absente » vs « fausse » — qui n'ont pas le même
// correctif — et l'empreinte, qui doit rester assez courte pour être lue à
// voix haute et assez précise pour départager deux clés.

type ModuleIdentite = typeof import("../backend-identity");

// Les valeurs sont résolues À L'IMPORT — elles décrivent le binaire, pas un
// état mutable. Chaque cas recharge donc le module dans un environnement
// choisi, d'où `resetModules` + `require` plutôt qu'un import statique.
const chargerAvec = (opts: {
  extra?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
}): ModuleIdentite => {
  jest.resetModules();
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: { expoConfig: { extra: opts.extra ?? {} } },
  }));
  const anciennes = { ...process.env };
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../backend-identity") as ModuleIdentite;
  } finally {
    process.env = anciennes;
  }
};

const CLE = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.charge.signature";

describe("provenance de l'adresse et de la clé", () => {
  it("prend le manifeste quand il est renseigné, et le dit", () => {
    const m = chargerAvec({
      extra: { supabaseUrl: "https://manifeste.example", supabaseAnonKey: CLE },
      env: {
        EXPO_PUBLIC_SUPABASE_URL: "https://build.example",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "cle-du-build",
      },
    });
    // La précédence n'est pas un détail : elle décide OÙ aller corriger.
    expect(m.backendUrl).toEqual({ valeur: "https://manifeste.example", provenance: "manifeste" });
    expect(m.backendAnonKey.provenance).toBe("manifeste");
  });

  it("retombe sur les variables figées au build", () => {
    const m = chargerAvec({
      extra: {},
      env: {
        EXPO_PUBLIC_SUPABASE_URL: "https://build.example",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: CLE,
      },
    });
    expect(m.backendUrl).toEqual({ valeur: "https://build.example", provenance: "build" });
    expect(m.backendAnonKey).toEqual({ valeur: CLE, provenance: "build" });
  });

  it("dit « absente » quand il n'y a rien — et ne fabrique pas de valeur", () => {
    const m = chargerAvec({
      extra: {},
      env: {
        EXPO_PUBLIC_SUPABASE_URL: undefined,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
    });
    expect(m.backendUrl).toEqual({ valeur: "", provenance: "absente" });
    expect(m.backendAnonKey).toEqual({ valeur: "", provenance: "absente" });
  });

  it("traite une chaîne vide dans le manifeste comme une absence", () => {
    // Un `extra` présent mais vide ne doit pas masquer la valeur du build :
    // sinon une config à moitié posée gagne sur une config complète.
    const m = chargerAvec({
      extra: { supabaseAnonKey: "" },
      env: { EXPO_PUBLIC_SUPABASE_ANON_KEY: CLE },
    });
    expect(m.backendAnonKey).toEqual({ valeur: CLE, provenance: "build" });
  });
});

describe("empreinte", () => {
  it("ne recopie jamais une clé longue en entier", () => {
    const { empreinte } = chargerAvec({});
    const longue = "a".repeat(169);
    const e = empreinte(longue);
    expect(e).not.toContain(longue);
    expect(e).toBe(`${"a".repeat(8)}…${"a".repeat(6)} (169)`);
  });

  it("distingue deux clés qui ne diffèrent qu'à la fin", () => {
    // Le cas réel : deux JWT au même en-tête, même émetteur, signatures
    // différentes. Une empreinte de tête seule les aurait dites identiques.
    const { empreinte } = chargerAvec({});
    expect(empreinte(`${CLE}AAAAAA`)).not.toBe(empreinte(`${CLE}BBBBBB`));
  });

  it("dit VIDE plutôt que de produire une empreinte trompeuse", () => {
    const { empreinte } = chargerAvec({});
    // « rien » et « faux » ne se réparent pas pareil : ne jamais les confondre.
    expect(empreinte("")).toBe("VIDE");
  });

  it("affiche en clair une valeur courte — une clé courte est déjà un défaut visible", () => {
    const { empreinte } = chargerAvec({});
    expect(empreinte("demo-anon-key")).toBe("demo-anon-key (13)");
  });
});

describe("ligne de diagnostic", () => {
  it("nomme l'hôte, la clé et la provenance des deux", () => {
    const m = chargerAvec({
      extra: {},
      env: {
        EXPO_PUBLIC_SUPABASE_URL: "https://api.spawt.online",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: CLE,
      },
    });
    const ligne = m.empreinteBackend();
    // Recopiable au téléphone par quelqu'un qui n'a pas l'appareil sous la main.
    expect(ligne).toContain("api.spawt.online [build]");
    expect(ligne).toContain("[build]");
    expect(ligne).not.toContain("https://");
    expect(ligne).not.toContain(CLE);
  });

  it("reste lisible quand tout manque", () => {
    const m = chargerAvec({
      extra: {},
      env: {
        EXPO_PUBLIC_SUPABASE_URL: undefined,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
      },
    });
    expect(m.empreinteBackend()).toBe("VIDE [absente] · clé VIDE [absente]");
  });
});
