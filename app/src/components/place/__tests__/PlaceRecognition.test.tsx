import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { PlaceRecognition } from "../PlaceRecognition";
import { portalSelection } from "../../../data/portal-selection";
import { getPlaceSelections } from "../../../lib/place-selections";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push:mockPush }) }));
jest.mock("react-i18next", () => ({useTranslation:()=>({t:(key:string)=>key})}));
jest.mock("../../../lib/place-selections", () => ({getPlaceSelections:jest.fn()}));
jest.mock("../../../lib/content-sync", () => ({useContentRevision:()=>0}));
jest.mock("../../../store/feature-flags", () => ({useFlag:()=>true}));

const fetchMemberships = jest.mocked(getPlaceSelections);
const leCha = portalSelection[0]!;
async function mount(id:string,signals:("institution"|"decouverte")[] = []) {
  let tree!:ReactTestRenderer;
  await act(async()=>{tree=create(<PlaceRecognition placeId={id} name="Le Cha" signals={signals}/>);});
  return tree;
}
beforeEach(()=>{jest.clearAllMocks();fetchMemberships.mockResolvedValue([]);});
it("keeps a place without any published selection or signal free of awards",async()=>{
  const tree=await mount("unlisted");
  expect(tree.toJSON()).toBeNull();
  act(()=>tree.unmount());
});
it("opens the published selection in the app and links to another actual place",async()=>{
  const tree=await mount(leCha.id);
  const editorial=tree.root.findAll(node=>node.props.accessibilityLabel==="place.portal_selection" && node.props.onPress)[0]!;
  act(()=>editorial.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Kaiten");
  const kaitenTitle=tree.root.findAll(node=>node.props.children==="Kaiten")[0]!;
  let link=kaitenTitle;
  while(!link.props.onPress && link.parent) link=link.parent;
  act(()=>link.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({pathname:"/place/[id]",params:{id:portalSelection[1]!.id}});
  act(()=>tree.unmount());
});
it("keeps an attributed signal beside the linked collection",async()=>{
  fetchMemberships.mockResolvedValue([{id:"c1",slug:"brunch",title_key:"collection.brunch",subtitle_key:null,cover_url:null}]);
  const tree=await mount("published",["institution"]);
  expect(JSON.stringify(tree.toJSON())).toContain("place.signal_institution");
  expect(JSON.stringify(tree.toJSON())).toContain("collection.brunch");
  const link=tree.root.findAll(node=>node.props.accessibilityLabel==="explore.collection_open_aria" && node.props.onPress)[0]!;
  act(()=>link.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({pathname:"/explore/[slug]",params:{slug:"brunch"}});
  act(()=>tree.unmount());
});
