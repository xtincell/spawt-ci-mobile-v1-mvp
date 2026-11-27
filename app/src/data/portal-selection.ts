import type { ImageSourcePropType } from "react-native";
import leCha from "./le-cha-review.json";

export interface PortalSelectionPlace {
  id: string; name: string; area: string; photo: ImageSourcePropType;
}

/** Membership of the editorial selection published on spawt.online.
 * Source: the portal's communityPlaces, headed “Les trouvailles de la Bande”.
 * Membership does not confer a prize, rank or certification.
 */
export const portalSelection: readonly PortalSelectionPlace[] = [
  { id:leCha.placeId, name:leCha.name, area:"Zone 4 · Marcory", photo:require("../../assets/editorial/le-cha-devanture.jpg") },
  { id:"a1000000-0000-4000-8000-000000000001",name:"Kaiten",area:"Zone 4 · Marcory",photo:require("../../assets/editorial/kaiten-nigiri.webp") },
  { id:"85433084-a972-563c-b9d1-6fac34f776d9",name:"DipnDip",area:"Prima Center · Marcory",photo:require("../../assets/editorial/dipndip-enseigne.webp") },
];

