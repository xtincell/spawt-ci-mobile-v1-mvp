import { useParams } from "react-router";
import { PlaceForm } from "../../components/PlaceForm";

export const LieuEdit = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <p>ID manquant</p>;
  return <PlaceForm mode="edit" id={id} />;
};
