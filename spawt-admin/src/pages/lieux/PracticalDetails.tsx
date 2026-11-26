import { useEffect, useState } from "react";
import { supabaseClient as db } from "../../utility/supabaseClient";

const sourceFields = {
  address: "Adresse",
  hours: "Horaires",
  phone: "Téléphone",
  website_url: "Site officiel",
  contact_email: "E-mail",
  google_maps_url: "Fiche Google Maps",
  social_links: "Réseaux sociaux",
  official_description: "Présentation",
  services: "Services",
  payment_methods: "Paiements",
  menu_urls: "Menus",
  price_range: "Prix observés",
} as const;
type Field = keyof typeof sourceFields;
type Link = { label: string; url: string };
type Source = Link & { checked_on: string; fields: Field[] };
type Details = {
  website_url: string;
  contact_email: string;
  google_maps_url: string;
  official_description: string;
  social_links: Link[];
  services: string[];
  payment_methods: string[];
  sources: Source[];
};
const empty = (): Details => ({
  website_url: "",
  contact_email: "",
  google_maps_url: "",
  official_description: "",
  social_links: [],
  services: [],
  payment_methods: [],
  sources: [],
});
function compact(details: Details) {
  return {
    ...details,
    website_url: details.website_url.trim() || null,
    contact_email: details.contact_email.trim() || null,
    google_maps_url: details.google_maps_url.trim() || null,
    official_description: details.official_description.trim() || null,
    services: details.services.map((v) => v.trim()).filter(Boolean),
    payment_methods: details.payment_methods.map((v) => v.trim()).filter(Boolean),
  };
}
const blankLink = () => ({ label: "", url: "" });
const blankSource = (): Source => ({ ...blankLink(), checked_on: "", fields: [] });

export function PracticalDetails({ placeId }: { placeId: string }) {
  const [value, setValue] = useState(empty);
  const [revision, setRevision] = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [load, setLoad] = useState(0);
  useEffect(() => {
    let active = true;
    setRevision(null);
    setError("");
    setMessage("");
    Promise.all([
      db
        .from("place_practical_profiles")
        .select("draft,published_document,revision")
        .eq("place_id", placeId)
        .maybeSingle(),
      db.rpc("current_staff").maybeSingle(),
    ])
      .then(([profile, staff]) => {
        if (!active) return;
        if (profile.error || staff.error) {
          setError("Les informations n’ont pas pu être chargées.");
          return;
        }
        const current = profile.data?.draft || {};
        setValue({
          ...empty(),
          ...Object.fromEntries(Object.entries(current).filter(([, v]) => v !== null)),
        });
        setRevision(profile.data?.revision || 0);
        setPublished(!!profile.data?.published_document);
        setAdmin((staff.data as { role?: string } | null)?.role === "admin");
      })
      .catch(() => {
        if (active) setError("Les informations n’ont pas pu être chargées.");
      });
    return () => {
      active = false;
    };
  }, [placeId, load]);
  function edit<K extends keyof Details>(key: K, next: Details[K]) {
    setValue((v) => ({ ...v, [key]: next }));
    setMessage("");
    setError("");
  }
  function editSource(index: number, change: Partial<Source>) {
    edit(
      "sources",
      value.sources.map((row, i) => (i === index ? { ...row, ...change } : row))
    );
  }
  async function save(action: "draft" | "publish" | "unpublish") {
    if (revision === null || busy) return;
    if (
      action === "unpublish" &&
      !window.confirm("Retirer ces informations pratiques de la fiche publique ?")
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await db.rpc("save_place_practical", {
        p_place_id: placeId,
        p_expected_revision: revision,
        p_document: compact(value),
        p_action: action,
      });
      if (result.error) {
        const code = result.error.code;
        const reason = result.error.message;
        if (code === "40001")
          setError(
            "Une autre personne a modifié la fiche. Recharge la version enregistrée avant de reprendre."
          );
        else if (reason.includes("source_required"))
          setError("Indique une source datée pour chaque information à publier.");
        else if (code === "42501") setError("Ton rôle ne permet pas cette opération.");
        else setError("Vérifie les liens HTTPS, les dates et les champs de chaque source.");
        return;
      }
      setRevision(result.data as number);
      if (action !== "draft") setPublished(action === "publish");
      setMessage(
        action === "draft"
          ? "Brouillon enregistré."
          : action === "publish"
          ? "Informations publiées."
          : "Publication retirée."
      );
    } catch {
      setError("Enregistrement indisponible. Tes modifications sont conservées dans ce formulaire.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Informations pratiques sourcées" style={{ maxWidth: 900, marginBlock: "2rem" }}>
      <h2>Informations pratiques sourcées</h2>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setLoad((n) => n + 1)}>
            Recharger la fiche
          </button>
        </p>
      )}
      {revision === null ? (
        !error && <p role="status">Chargement…</p>
      ) : (
        <>
          <p>{published ? "Une version publique est disponible." : "Aucune version publique."}</p>
          <fieldset disabled={busy}>
            <legend>Contact et services</legend>
            {(["website_url", "contact_email", "google_maps_url"] as const).map((key) => (
              <p key={key}>
                <label>
                  {sourceFields[key]}
                  <br />
                  <input
                    type={key === "contact_email" ? "email" : "url"}
                    value={value[key]}
                    onChange={(e) => edit(key, e.target.value)}
                    size={55}
                  />
                </label>
              </p>
            ))}
            <p>
              <label>
                Présentation de l’établissement
                <br />
                <textarea
                  value={value.official_description}
                  onChange={(e) => edit("official_description", e.target.value)}
                  rows={3}
                  cols={65}
                />
              </label>
            </p>
            {(["services", "payment_methods"] as const).map((key) => (
              <p key={key}>
                <label>
                  {sourceFields[key]} · un par ligne
                  <br />
                  <textarea
                    value={value[key].join("\n")}
                    onChange={(e) => edit(key, e.target.value.split("\n"))}
                    rows={3}
                    cols={55}
                  />
                </label>
              </p>
            ))}
            <h3>Réseaux sociaux</h3>
            {value.social_links.map((row, i) => (
              <p key={i}>
                <label>
                  Réseau {i + 1}{" "}
                  <input
                    value={row.label}
                    onChange={(e) =>
                      edit(
                        "social_links",
                        value.social_links.map((v, j) => (j === i ? { ...v, label: e.target.value } : v))
                      )
                    }
                  />
                </label>{" "}
                <label>
                  Lien{" "}
                  <input
                    type="url"
                    value={row.url}
                    onChange={(e) =>
                      edit(
                        "social_links",
                        value.social_links.map((v, j) => (j === i ? { ...v, url: e.target.value } : v))
                      )
                    }
                  />
                </label>{" "}
                <button
                  type="button"
                  onClick={() =>
                    edit(
                      "social_links",
                      value.social_links.filter((_, j) => j !== i)
                    )
                  }
                >
                  Retirer ce réseau
                </button>
              </p>
            ))}
            <button type="button" onClick={() => edit("social_links", [...value.social_links, blankLink()])}>
              Ajouter un réseau
            </button>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Sources visibles sur la fiche</legend>
            {value.sources.map((s, i) => (
              <fieldset key={i}>
                <legend>Source {i + 1}</legend>
                <p>
                  <label>
                    Libellé{" "}
                    <input value={s.label} onChange={(e) => editSource(i, { label: e.target.value })} />
                  </label>{" "}
                  <label>
                    Page consultée{" "}
                    <input
                      value={s.url}
                      type="url"
                      onChange={(e) => editSource(i, { url: e.target.value })}
                    />
                  </label>{" "}
                  <label>
                    Vérifiée le{" "}
                    <input
                      type="date"
                      value={s.checked_on}
                      onChange={(e) => editSource(i, { checked_on: e.target.value })}
                    />
                  </label>
                </p>
                {Object.entries(sourceFields).map(([field, label]) => (
                  <label key={field} style={{ display: "inline-block", marginRight: "1em" }}>
                    <input
                      type="checkbox"
                      checked={s.fields.includes(field as Field)}
                      onChange={(e) =>
                        editSource(i, {
                          fields: e.target.checked
                            ? [...s.fields, field as Field]
                            : s.fields.filter((k) => k !== field),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
                <p>
                  <button
                    type="button"
                    onClick={() =>
                      edit(
                        "sources",
                        value.sources.filter((_, j) => j !== i)
                      )
                    }
                  >
                    Retirer cette source
                  </button>
                </p>
              </fieldset>
            ))}
            <button type="button" onClick={() => edit("sources", [...value.sources, blankSource()])}>
              Ajouter une source
            </button>
          </fieldset>
          <p>
            <button type="button" disabled={busy} onClick={() => void save("draft")}>
              Enregistrer le brouillon
            </button>{" "}
            {admin && (
              <button type="button" disabled={busy} onClick={() => void save("publish")}>
                Publier les informations
              </button>
            )}{" "}
            {admin && published && (
              <button type="button" disabled={busy} onClick={() => void save("unpublish")}>
                Retirer de la fiche publique
              </button>
            )}
          </p>
          <p role="status">{message}</p>
        </>
      )}
    </section>
  );
}
