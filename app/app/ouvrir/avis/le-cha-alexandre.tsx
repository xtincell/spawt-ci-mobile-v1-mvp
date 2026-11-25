import { Redirect } from "expo-router";

export default function OpenLeChaReview() {
  return <Redirect href={{
    pathname: "/lieu/[id]/avis/alexandre",
    params: { id: "ef8f3289-a9ca-56f0-899c-f95f93ee9c75" },
  }} />;
}
