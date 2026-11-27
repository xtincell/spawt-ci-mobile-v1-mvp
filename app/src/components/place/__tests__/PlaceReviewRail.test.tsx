import { act,create,type ReactTestRenderer } from "react-test-renderer";
import { PlaceReviewRail } from "../PlaceReviewRail";
import type { PlaceReview } from "../../../lib/data-source";
import editorial from "../../../data/le-cha-review.json";

const mockPush = jest.fn();
jest.mock("expo-router",()=>({useRouter:()=>({push:mockPush})}));
jest.mock("react-i18next",()=>({useTranslation:()=>({t:(k:string)=>k})}));
jest.mock("../../../store/spawter-store",()=>({useSpawterStore:(fn:(s:unknown)=>unknown)=>fn({spawter:null})}));
jest.mock("../../../lib/data-source",()=>({isSupabaseConfigured:false}));

it("keeps Alexandre's photo in its card and opens his dedicated review, with no synthetic reviewers",async()=>{
  let tree!:ReactTestRenderer;
  await act(async()=>{tree=create(<PlaceReviewRail placeId={editorial.placeId} reviews={[]}/>);});
  const card=tree.root.findAll(n=>n.props.accessibilityLabel==="place.open_review · Alexandre" && n.props.onPress)[0]!;
  expect(card).toBeTruthy();
  const body=JSON.stringify(tree.toJSON());
  expect(body).toContain("Alexandre");expect(body).not.toContain("NayaK");
  act(()=>card.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({pathname:"/lieu/[id]/avis/alexandre",params:{id:editorial.placeId}});
  act(()=>tree.unmount());
});
it("shows the published stage and lets a short review expand into all three scores",async()=>{
  const review:PlaceReview={id:"01",spawter_id:"02",spawter_display_name:"Un pseudo",spawter_avatar_url:null,spawter_stage:"djidji",note_etoiles:4,note_globale:4,note_cuisine:5,note_cadre:4,note_service:3,texte_avis:"Très bon.",photos:[],created_at:"2026-11-24",is_seed:false};
  let tree!:ReactTestRenderer;
  await act(async()=>{tree=create(<PlaceReviewRail placeId="02" reviews={[review]}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain("Djidji");
  expect(JSON.stringify(tree.toJSON())).not.toContain("review.ratings_detail");
  const card=tree.root.findAll(n=>n.props.accessibilityLabel==="place.open_review · Un pseudo" && n.props.onPress)[0]!;
  act(()=>card.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("review.ratings_detail");
  act(()=>tree.unmount());
});
