import { Link, useParams } from "react-router";
import { PlaceForm } from "../../components/PlaceForm";

export const LieuEdit = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <p>ID manquant</p>;
  return <><p><Link to={`/lieux/editorial/${id}`}>Profil identitaire, notes d’équipe et avis éditoriaux →</Link></p><PlaceForm key={id} mode="edit" id={id} /></>;
};
