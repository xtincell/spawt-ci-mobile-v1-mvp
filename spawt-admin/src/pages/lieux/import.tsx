// ============================================================================
// Import d'inventaire — écran opérateur (.xlsx / .xls / .csv)
// ============================================================================
// Charger l'inventaire est le travail de l'équipe terrain, pas d'un
// développeur. Jusqu'ici le seul chemin en masse était un script Node à cinq
// variables d'environnement : concrètement, personne d'autre que la tech ne
// pouvait ajouter vingt lieux.
//
// Le parcours ici : on dépose un fichier, on VOIT ce qui sera créé et ce qui
// coince ligne par ligne, puis seulement on confirme. Rien n'est écrit avant
// le clic — un import qui insère la moitié d'un fichier avant de planter est
// pire que pas d'import du tout.
//
// L'écriture passe par la session staff (policies 0018) : pas de clé de
// service dans le navigateur, et l'audit reste attribué au bon compte.

import { useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";

import { supabaseClient } from "../../utility/supabaseClient";
import { analyser, COLONNES, gabaritCsv, type LieuImporte, type ResultatAnalyse } from "./import-logic";

type Etat =
  | { phase: "attente" }
  | { phase: "lecture" }
  | { phase: "revue"; nomFichier: string; analyse: ResultatAnalyse }
  | { phase: "envoi"; total: number; faits: number }
  | { phase: "termine"; crees: number; rejetes: { nom: string; raison: string }[] }
  | { phase: "erreur"; message: string };

export const LieuxImport = () => {
  const navigate = useNavigate();
  const [etat, setEtat] = useState<Etat>({ phase: "attente" });

  const lireFichier = async (file: File) => {
    setEtat({ phase: "lecture" });
    try {
      const buf = await file.arrayBuffer();
      // `cellDates` : une date saisie dans Excel ne doit pas ressortir en
      // numéro de série. `defval: ""` : une cellule vide devient une chaîne
      // vide plutôt que d'être absente, sinon la colonne disparaît de l'objet
      // et l'erreur remontée serait « colonne manquante » au lieu de « vide ».
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const premiere = wb.SheetNames[0];
      if (!premiere) {
        setEtat({ phase: "erreur", message: "Ce fichier ne contient aucune feuille." });
        return;
      }
      const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[premiere]!, {
        defval: "",
        raw: false,
      });
      if (lignes.length === 0) {
        setEtat({
          phase: "erreur",
          message: `La feuille « ${premiere} » est vide (ou n'a qu'une ligne d'en-têtes).`,
        });
        return;
      }
      setEtat({ phase: "revue", nomFichier: file.name, analyse: analyser(lignes) });
    } catch (e) {
      setEtat({
        phase: "erreur",
        message: `Fichier illisible : ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const importer = async (lieux: LieuImporte[]) => {
    setEtat({ phase: "envoi", total: lieux.length, faits: 0 });
    const rejetes: { nom: string; raison: string }[] = [];
    let crees = 0;

    // Un par un, volontairement : un insert groupé échoue en bloc au premier
    // doublon et on ne saurait pas lequel. Ici chaque échec est nommé, et les
    // lignes saines passent quand même.
    for (const lieu of lieux) {
      const { data, error } = await supabaseClient
        .from("places")
        .insert({
          ...lieu,
          hours: {},
          gallery_urls: [],
          menu_urls: [],
          signals: [],
          city_code: "abidjan",
        })
        .select("id")
        .single();

      if (error) {
        rejetes.push({
          nom: lieu.name,
          raison:
            error.code === "23505"
              ? "un lieu porte déjà ce nom dans ce quartier"
              : error.message,
        });
      } else {
        crees += 1;
        // L'ADN naît neutre : aucun avis, aucun axe. Il se remplira par les
        // avis, ou à la main dans la fiche. Un échec ici n'annule pas le lieu.
        await supabaseClient.from("place_adn").insert({ place_id: data.id });
      }
      setEtat({ phase: "envoi", total: lieux.length, faits: crees + rejetes.length });
    }

    setEtat({ phase: "termine", crees, rejetes });
  };

  const telechargerGabarit = () => {
    const blob = new Blob(["﻿" + gabaritCsv()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "spawt-gabarit-inventaire.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <h1 style={{ marginBottom: 4 }}>Importer des lieux</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Fichier Excel (.xlsx, .xls) ou CSV. La première feuille, première ligne = en-têtes.
        Rien n&apos;est écrit tant que tu n&apos;as pas confirmé.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0" }}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          data-testid="import-file"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) void lireFichier(f);
          }}
        />
        <button type="button" onClick={telechargerGabarit}>
          Télécharger le gabarit
        </button>
      </div>

      <details style={{ marginBottom: 20 }}>
        <summary style={{ cursor: "pointer" }}>Colonnes attendues</summary>
        <p style={{ opacity: 0.8, fontSize: 14 }}>
          <code>{COLONNES.join(" · ")}</code>
          <br />
          Les accents, majuscules et espaces des en-têtes sont ignorés. Une colonne
          en trop est signalée, jamais avalée en silence. <strong>gamme</strong> vaut
          1, 2 ou 3 ; <strong>publie</strong> accepte oui/non.
        </p>
      </details>

      {etat.phase === "lecture" ? <p>Lecture du fichier…</p> : null}

      {etat.phase === "erreur" ? (
        <p role="alert" style={{ color: "#B00020" }} data-testid="import-erreur">
          {etat.message}
        </p>
      ) : null}

      {etat.phase === "revue" ? (
        <section data-testid="import-revue">
          <h2 style={{ fontSize: 18 }}>
            {etat.nomFichier} — {etat.analyse.valides.length} lieu(x) prêt(s),{" "}
            {etat.analyse.erreurs.length} ligne(s) à corriger
          </h2>

          {etat.analyse.colonnesIgnorees.length > 0 ? (
            <p style={{ opacity: 0.8 }}>
              Colonnes non reconnues, laissées de côté :{" "}
              <code>{etat.analyse.colonnesIgnorees.join(", ")}</code>
            </p>
          ) : null}

          {etat.analyse.erreurs.length > 0 ? (
            <div style={{ margin: "12px 0" }}>
              <h3 style={{ fontSize: 15 }}>À corriger dans ton tableur</h3>
              <ul style={{ fontSize: 14 }}>
                {etat.analyse.erreurs.map((er) => (
                  <li key={er.ligne}>
                    <strong>Ligne {er.ligne}</strong> ({er.nom}) : {er.erreurs.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {etat.analyse.valides.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Nom", "Quartier", "Cuisine", "Gamme", "Ticket", "Publié"].map((h) => (
                    <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 6 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etat.analyse.valides.map((l, i) => (
                  <tr key={`${l.name}-${i}`}>
                    <td style={{ padding: 6 }}>{l.name}</td>
                    <td style={{ padding: 6 }}>{l.neighborhood}</td>
                    <td style={{ padding: 6 }}>{l.cuisine.join(", ")}</td>
                    <td style={{ padding: 6 }}>{l.price_tier}</td>
                    <td style={{ padding: 6 }}>{l.avg_ticket_xof ?? "—"}</td>
                    <td style={{ padding: 6 }}>{l.is_published ? "oui" : "non"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <button
            type="button"
            data-testid="import-confirmer"
            disabled={etat.analyse.valides.length === 0}
            onClick={() => void importer(etat.analyse.valides)}
            style={{ marginTop: 16, padding: "8px 16px" }}
          >
            Créer {etat.analyse.valides.length} lieu(x)
          </button>
        </section>
      ) : null}

      {etat.phase === "envoi" ? (
        <p>
          Création en cours — {etat.faits} / {etat.total}
        </p>
      ) : null}

      {etat.phase === "termine" ? (
        <section data-testid="import-termine">
          <h2 style={{ fontSize: 18 }}>{etat.crees} lieu(x) créé(s)</h2>
          {etat.rejetes.length > 0 ? (
            <>
              <p>Non créés :</p>
              <ul style={{ fontSize: 14 }}>
                {etat.rejetes.map((r) => (
                  <li key={r.nom}>
                    <strong>{r.nom}</strong> — {r.raison}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" onClick={() => navigate("/lieux")} style={{ marginTop: 12 }}>
            Voir les lieux
          </button>
        </section>
      ) : null}
    </div>
  );
};
