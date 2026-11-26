import React, { type ReactNode } from "react";
// @ts-ignore -- react-test-renderer has no TypeScript declarations here.
import TestRenderer from "react-test-renderer";
import { DishRatingButton } from "../../src/components/DishRatingButton";
import { readMenuItemRating, writeMenuItemRating } from "../../src/lib/menu-item-ratings";

jest.mock("../../src/lib/menu-item-ratings", () => ({ readMenuItemRating: jest.fn(), writeMenuItemRating: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({SafeAreaView: ({children}:{children:ReactNode}) => children}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({t:(key:string) => key}) }));
jest.mock("expo-router", () => ({ useRouter: () => ({push:jest.fn()}) }));
const read=jest.mocked(readMenuItemRating);
const write=jest.mocked(writeMenuItemRating);

test("opens without assigning a score, and edits or clears only after a deliberate tap", async () => {
  let mounted!: ReturnType<typeof TestRenderer.create>;
  read.mockResolvedValueOnce(null).mockResolvedValueOnce(4).mockResolvedValueOnce(2);
  write.mockResolvedValue(undefined);
  await TestRenderer.act(async () => { mounted=TestRenderer.create(<DishRatingButton owner="a" dishId="d" name="Eggs" published />); });
  const press = async (id:string) => {
    const button=mounted.root.findAllByProps({testID:id}).find((node:{props:{onPress?:unknown}}) => typeof node.props.onPress === "function");
    if (!button) throw new Error("Missing control: " + id);
    await TestRenderer.act(async () => { await button.props.onPress(); });
  };
  await press("dish-rating-d");
  expect(write).not.toHaveBeenCalled();
  await press("dish-score-4");
  expect(write).not.toHaveBeenCalled();
  await press("dish-rating-save");
  await press("dish-rating-d"); await press("dish-score-2"); await press("dish-rating-save");
  await press("dish-rating-d"); await press("dish-rating-clear");
  expect(write.mock.calls).toEqual([["a","d",4],["a","d",2],["a","d",null]]);
});
