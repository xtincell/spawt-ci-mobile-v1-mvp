// Console admin — page « Mode d'emploi », pour les développeurs qui reprennent.
//
// Un runbook qu'il faut cloner un dépôt pour lire n'est pas lu. Celui-ci
// s'ouvre depuis la console, derrière l'authentification staff, à côté des
// écrans qu'il décrit. Le contenu vit dans content.ts (données pures), la vue
// ne fait que le rendre : on peut donc le tester et le relire sans navigateur.

import { useState } from "react";
import { RUNBOOK, type RunbookBloc } from "./content";

export const RunbookPage = () => {
  const [ouvert, setOuvert] = useState<string | null>(RUNBOOK[0]?.id ?? null);

  return (
    <div>
      <h1>Mode d'emploi</h1>
      <p style={{ color: "var(--ink-mute)", maxWidth: "68ch" }}>
        Ce qu'il faut savoir pour faire tourner SPAWT après nous : déployer,
        migrer, encaisser, allumer une fonctionnalité — et les pièges qui ont
        déjà coûté une journée à quelqu'un. Aucun secret ici : les clés vivent
        dans Coolify et dans le gestionnaire de mots de passe de l'équipe.
      </p>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "20px 0" }}>
        {RUNBOOK.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={ouvert === s.id}
            onClick={() => setOuvert(s.id)}
          >
            {s.titre}
          </button>
        ))}
      </nav>

      {RUNBOOK.map((section) => (
        <section
          key={section.id}
          hidden={ouvert !== section.id}
          aria-labelledby={`runbook-${section.id}`}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 18,
            maxWidth: "76ch",
          }}
        >
          <h2 id={`runbook-${section.id}`} style={{ marginTop: 0 }}>
            {section.titre}
          </h2>
          <p style={{ color: "var(--ink-mute)", marginTop: -8 }}>{section.resume}</p>
          {section.blocs.map((bloc, i) => (
            <Bloc key={`${section.id}-${i}`} bloc={bloc} />
          ))}
        </section>
      ))}
    </div>
  );
};

function Bloc({ bloc }: { bloc: RunbookBloc }) {
  if (bloc.type === "p") {
    return <p style={{ lineHeight: 1.65 }}>{bloc.texte}</p>;
  }

  if (bloc.type === "liste") {
    return (
      <ul style={{ lineHeight: 1.65, paddingLeft: 20 }}>
        {(bloc.lignes ?? []).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    );
  }

  if (bloc.type === "code") {
    return (
      <pre
        style={{
          background: "var(--bg-night)",
          color: "var(--ink-inverse)",
          padding: 14,
          borderRadius: 6,
          overflowX: "auto",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <code>{(bloc.lignes ?? []).join("\n")}</code>
      </pre>
    );
  }

  // « alerte » : un piège vérifié, pas une précaution de style. On le distingue
  // visuellement parce que c'est ce qu'on relit en diagonale à 2 h du matin.
  return (
    <p
      style={{
        borderLeft: "4px solid var(--danger)",
        background: "var(--bg-warm)",
        padding: "10px 14px",
        borderRadius: 4,
        lineHeight: 1.65,
      }}
    >
      <strong>Piège — </strong>
      {bloc.texte}
    </p>
  );
}
