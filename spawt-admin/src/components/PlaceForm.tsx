// Story 6.2 — Formulaire CRUD lieu partagé create/edit.
// Validation Zod + audit log + upload photo.
//
// CR Chunk B :
//   M11 — disable cover upload en create mode (path draft-* orphelin sinon)
//   M12 — atomicité createPlace + createPlaceAdn (rollback si adn fail)
//   M10 — uploadPlacePhoto retourne UploadResult (avec error structuré)
//   M9 — audit best-effort + UI feedback inline
//   m7 — useEffect dirty wipe protégé par useRef hydratedOnce

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useCreate, useDelete, useOne, useUpdate } from "@refinedev/core";

import { PlaceFormSchema, PlaceAdnFormSchema, type PlaceForm as PlaceFormValues } from "../types/place.schema";
import { logAuditActionBestEffort } from "../lib/audit";
import { uploadPlacePhoto } from "../lib/storage";

const ABIDJAN_NEIGHBORHOODS = [
  "Cocody", "Plateau", "Marcory", "Treichville", "Yopougon", "Abobo",
  "Adjamé", "Attécoubé", "Koumassi", "Port-Bouët", "Bingerville", "Songon",
];

const CUISINES = [
  "ivoirienne", "ouest_africaine", "libanaise", "asiatique", "europeenne",
  "italienne", "francaise", "fusion", "vegetarienne", "fastfood",
  "patisserie", "cafe", "maquis", "grillades", "fruits_de_mer",
];

const PLACE_SIGNALS = ["institution", "coup_de_coeur", "pepite_verifiee", "hype", "nouveau", "sceptique"];

interface Props {
  mode: "create" | "edit";
  id?: string;
}

const emptyForm: PlaceFormValues = {
  name: "",
  cuisine: [],
  location: { lat: 5.35, lng: -3.97, descriptive_address: "", neighborhood: "Cocody", city: "Abidjan" },
  price: { tier: 2, avg_ticket_xof: null },
  hours: {},
  phone: null,
  whatsapp: null,
  cover_photo_url: null,
  gallery_urls: [],
  menu_urls: [],
  signals: [],
  is_published: false,
};

// menu_urls (array) édité via textarea « une URL par ligne » — parse symétrique.
function parseUrlLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const PlaceForm = ({ mode, id }: Props) => {
  const navigate = useNavigate();
  const { query: existingQuery } = useOne({
    resource: "places",
    id: id ?? "",
    meta: { select: "*, place_adn(*)" },
    queryOptions: { enabled: mode === "edit" && !!id },
  });
  const existingData = existingQuery.data;
  const loadingExisting = existingQuery.isLoading;
  const { mutateAsync: createPlace } = useCreate();
  const { mutateAsync: updatePlace } = useUpdate();
  const { mutateAsync: deletePlace } = useDelete();
  const [submitting, setSubmitting] = useState(false);
  const { mutateAsync: createPlaceAdn } = useCreate();
  const { mutateAsync: updatePlaceAdn } = useUpdate();
  const [uploadError, setUploadError] = useState<string | null>(null);
  // CR m7 — useEffect re-sync re-écrase les valeurs en cours d'édition à
  // chaque refetch. On gate avec useRef pour ne sync qu'au premier load réussi
  // (sinon l'utilisateur perd ses changements unsaved à la prochaine query).
  const hydratedOnce = useRef(false);

  const [values, setValues] = useState<PlaceFormValues>(emptyForm);
  // Miroir texte du champ menu_urls (une URL par ligne) — évite que le
  // roundtrip join/split avale la ligne vide en cours de saisie.
  const [menuUrlsText, setMenuUrlsText] = useState("");
  const [adn, setAdn] = useState({
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (mode === "edit" && existingData?.data && !hydratedOnce.current) {
      hydratedOnce.current = true;
      const row = existingData.data as Record<string, unknown> & {
        place_adn?: typeof adn | null;
      };
      // Re-pivot DB flat → form nested.
      setValues({
        ...emptyForm,
        name: (row.name as string) ?? "",
        cuisine: (row.cuisine as string[]) ?? [],
        location: {
          lat: (row.lat as number) ?? 0,
          lng: (row.lng as number) ?? 0,
          descriptive_address: (row.descriptive_address as string) ?? "",
          neighborhood: (row.neighborhood as string) ?? "Cocody",
          city: (row.city as string) ?? "Abidjan",
        },
        price: {
          tier: ((row.price_tier as 1 | 2 | 3) ?? 2),
          avg_ticket_xof: (row.avg_ticket_xof as number) ?? null,
        },
        hours: (row.hours as PlaceFormValues["hours"]) ?? {},
        phone: (row.phone as string) ?? null,
        whatsapp: (row.whatsapp as string) ?? null,
        cover_photo_url: (row.cover_photo_url as string) ?? null,
        gallery_urls: (row.gallery_urls as string[]) ?? [],
        menu_urls: (row.menu_urls as string[]) ?? [],
        signals: (row.signals as PlaceFormValues["signals"]) ?? [],
        is_published: Boolean(row.is_published),
      });
      setMenuUrlsText(((row.menu_urls as string[]) ?? []).join("\n"));
      if (row.place_adn) {
        const pa = row.place_adn as Record<string, unknown>;
        setAdn({
          axe_local_international: Number(pa.axe_local_international ?? 0),
          axe_informel_etabli: Number(pa.axe_informel_etabli ?? 0),
          axe_budget_premium: Number(pa.axe_budget_premium ?? 0),
          axe_populaire_prive: Number(pa.axe_populaire_prive ?? 0),
          axe_decontracte_habille: Number(pa.axe_decontracte_habille ?? 0),
        });
      }
    }
  }, [existingData, mode]);

  const beforeSnapshot = useMemo(() => (existingData?.data ?? null), [existingData]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    const parsed = PlaceFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.errors.map((er) => `${er.path.join(".")}: ${er.message}`));
      return;
    }
    const parsedAdn = PlaceAdnFormSchema.safeParse(adn);
    if (!parsedAdn.success) {
      setErrors(parsedAdn.error.errors.map((er) => `ADN ${er.path.join(".")}: ${er.message}`));
      return;
    }

    const dbRow = {
      name: parsed.data.name,
      cuisine: parsed.data.cuisine,
      lat: parsed.data.location.lat,
      lng: parsed.data.location.lng,
      descriptive_address: parsed.data.location.descriptive_address,
      neighborhood: parsed.data.location.neighborhood,
      city: parsed.data.location.city,
      price_tier: parsed.data.price.tier,
      avg_ticket_xof: parsed.data.price.avg_ticket_xof ?? null,
      hours: parsed.data.hours,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      cover_photo_url: parsed.data.cover_photo_url ?? null,
      gallery_urls: parsed.data.gallery_urls,
      menu_urls: parsed.data.menu_urls,
      signals: parsed.data.signals,
      is_published: parsed.data.is_published,
    };

    setSubmitting(true);
    try {
      if (mode === "create") {
        // M12 — atomicité : create place + create place_adn chaînés avec
        // rollback du place si l'adn échoue (sinon orphan place sans ADN
        // crashera le mobile au JOIN).
        const placeRes = await createPlace({ resource: "places", values: dbRow });
        const placeId = (placeRes.data as { id: string }).id;
        try {
          await createPlaceAdn({
            resource: "place_adn",
            values: { place_id: placeId, ...parsedAdn.data, total_reviews: 0, confidence_score: 0, weighted_rating: 0 },
          });
        } catch (adnErr) {
          // Rollback explicite du place pour éviter l'orphan.
          await deletePlace({ resource: "places", id: placeId }).catch(() => undefined);
          throw new Error(
            `place_adn creation failed (place rolled back): ${adnErr instanceof Error ? adnErr.message : String(adnErr)}`,
          );
        }
        await logAuditActionBestEffort({
          action: "place_create",
          entity_type: "place",
          entity_id: placeId,
          payload_before: null,
          payload_after: { ...dbRow, adn: parsedAdn.data },
        });
        navigate("/lieux");
      } else if (id) {
        await updatePlace({ resource: "places", id, values: dbRow });
        await updatePlaceAdn({
          resource: "place_adn",
          id,
          values: parsedAdn.data,
        });
        await logAuditActionBestEffort({
          action: "place_update",
          entity_type: "place",
          entity_id: id,
          payload_before: beforeSnapshot,
          payload_after: { ...dbRow, adn: parsedAdn.data },
        });
        await logAuditActionBestEffort({
          action: "place_adn_update",
          entity_type: "place_adn",
          entity_id: id,
          payload_before: (beforeSnapshot as { place_adn?: typeof adn } | null)?.place_adn ?? null,
          payload_after: parsedAdn.data,
        });
        navigate("/lieux");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrors((prev) => [...prev, msg]);
    } finally {
      setSubmitting(false);
    }
  }

  async function onUploadCover(file: File | null) {
    if (!file) return;
    setUploadError(null);
    if (!id) {
      // M11 — disable upload en create mode : sans placeId valide, le path
      // serait `places/draft-<ts>/` ce qui (1) viole la policy RLS storage
      // qui exige un UUID dans foldername[2], (2) crée des orphans Storage
      // jamais nettoyés. Force l'admin à créer le lieu d'abord puis éditer.
      setUploadError("Crée d'abord le lieu (bouton « Créer »), puis viens éditer pour ajouter la photo de couverture.");
      return;
    }
    const result = await uploadPlacePhoto(id, file);
    if (result.error) {
      const detail =
        result.error.code === "INVALID_MIME"
          ? `Type de fichier non autorisé (${result.error.received}). Formats acceptés : JPEG, PNG, WebP.`
          : result.error.code === "FILE_TOO_LARGE"
          ? `Fichier trop volumineux (${Math.round(result.error.size / 1024)} KB > ${Math.round(result.error.limit / 1024)} KB max).`
          : result.error.code === "INVALID_PLACE_ID"
          ? "ID du lieu invalide."
          : `Échec upload : ${result.error.message}`;
      setUploadError(detail);
      return;
    }
    if (result.publicUrl) setValues((v) => ({ ...v, cover_photo_url: result.publicUrl! }));
  }

  if (mode === "edit" && loadingExisting) return <p>Chargement…</p>;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <h1>{mode === "create" ? "Nouveau lieu" : "Édition lieu"}</h1>

      {errors.length > 0 ? (
        <div style={{ background: "var(--bg-warm)", padding: 12, borderRadius: 6 }}>
          {errors.map((er) => (<div key={er} style={{ color: "var(--danger)" }}>• {er}</div>))}
        </div>
      ) : null}

      <fieldset>
        <legend>Identité</legend>
        <label>Nom du lieu
          <input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} style={{ width: "100%" }} />
        </label>
        <label>Cuisines
          <select multiple value={values.cuisine} onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
            setValues({ ...values, cuisine: opts });
          }} style={{ width: "100%", height: 120 }}>
            {CUISINES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </label>
        <label>Signaux
          <select multiple value={values.signals} onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => o.value) as PlaceFormValues["signals"];
            setValues({ ...values, signals: opts });
          }} style={{ width: "100%", height: 100 }}>
            {PLACE_SIGNALS.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Localisation</legend>
        <label>Latitude
          <input type="number" step="0.000001" value={values.location.lat}
            onChange={(e) => setValues({ ...values, location: { ...values.location, lat: Number(e.target.value) } })} />
        </label>
        <label>Longitude
          <input type="number" step="0.000001" value={values.location.lng}
            onChange={(e) => setValues({ ...values, location: { ...values.location, lng: Number(e.target.value) } })} />
        </label>
        <label>Adresse descriptive
          <input value={values.location.descriptive_address}
            onChange={(e) => setValues({ ...values, location: { ...values.location, descriptive_address: e.target.value } })}
            style={{ width: "100%" }} />
        </label>
        <label>Quartier
          <select value={values.location.neighborhood}
            onChange={(e) => setValues({ ...values, location: { ...values.location, neighborhood: e.target.value } })}>
            {ABIDJAN_NEIGHBORHOODS.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Tarification</legend>
        <label>Tier
          <select value={values.price.tier}
            onChange={(e) => setValues({ ...values, price: { ...values.price, tier: Number(e.target.value) as 1 | 2 | 3 } })}>
            <option value={1}>1 — Économique</option>
            <option value={2}>2 — Moyen</option>
            <option value={3}>3 — Premium</option>
          </select>
        </label>
        <label>Ticket moyen (XOF)
          <input type="number" value={values.price.avg_ticket_xof ?? ""}
            onChange={(e) => setValues({ ...values, price: { ...values.price, avg_ticket_xof: e.target.value ? Number(e.target.value) : null } })} />
        </label>
        {/* Décision Q4 (MAJ consolidée 07/2026) — convention éditoriale du prix
            moyen affiché « ~N F CFA » sur la fiche lieu (flag place-avg-price). */}
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "6px 0 0" }}>
          Convention : repas type par personne (plat + accompagnement), boissons non comprises —
          méthode éditoriale, saisie depuis le menu du lieu.
        </p>
      </fieldset>

      <fieldset>
        <legend>Contact</legend>
        <label>Téléphone (+225…)
          <input value={values.phone ?? ""} onChange={(e) => setValues({ ...values, phone: e.target.value || null })} />
        </label>
        <label>WhatsApp (+225…)
          <input value={values.whatsapp ?? ""} onChange={(e) => setValues({ ...values, whatsapp: e.target.value || null })} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Photo de couverture</legend>
        {mode === "create" ? (
          <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 8px 0" }}>
            La photo s'ajoute après création du lieu (édition).
          </p>
        ) : (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onUploadCover(e.target.files?.[0] ?? null)}
          />
        )}
        {uploadError ? (
          <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{uploadError}</p>
        ) : null}
        {values.cover_photo_url ? <p style={{ fontSize: 11 }}>{values.cover_photo_url}</p> : null}
      </fieldset>

      <fieldset>
        <legend>Photos du menu</legend>
        <label>Photos du menu (URLs)
          <textarea
            value={menuUrlsText}
            rows={4}
            placeholder={"https://…/menu-page-1.jpg\nhttps://…/menu-page-2.jpg"}
            onChange={(e) => {
              const text = e.target.value;
              setMenuUrlsText(text);
              setValues((v) => ({ ...v, menu_urls: parseUrlLines(text) }));
            }}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "6px 0 0" }}>
          Une URL par ligne (même sémantique que la galerie du lieu).
        </p>
      </fieldset>

      <fieldset>
        <legend>ADN (5 axes, range [-1, 1])</legend>
        {(Object.keys(adn) as Array<keyof typeof adn>).map((k) => (
          <label key={k} style={{ display: "block" }}>
            {k}
            <input type="range" min={-1} max={1} step={0.05} value={adn[k]}
              onChange={(e) => setAdn({ ...adn, [k]: Number(e.target.value) })} />
            <span>{Number(adn[k] ?? 0).toFixed(2)}</span>
          </label>
        ))}
      </fieldset>

      <label>
        <input type="checkbox" checked={values.is_published}
          onChange={(e) => setValues({ ...values, is_published: e.target.checked })} />{" "}
        Publié (visible côté mobile)
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {mode === "create" ? "Créer" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => navigate("/lieux")}>Annuler</button>
      </div>
    </form>
  );
};
