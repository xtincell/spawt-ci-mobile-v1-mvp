import { Redirect, useLocalSearchParams } from "expo-router";
export default function PublicPlaceLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/place/[id]", params: { id } }} />;
}
