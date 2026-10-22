import React from "react";
import { act, create } from "react-test-renderer";
import { SpawterAvatar } from "../SpawterAvatar";
test("Moka sans photo, photo personnalisée, puis Moka en cas d'image défaillante", async () => {
  let r!: ReturnType<typeof create>;
  await act(async () => { r = create(<SpawterAvatar url={null} testID="avatar" />); });
  expect(r.root.findByProps({ testID: "avatar-moka" })).toBeDefined();
  await act(async () => { r.update(<SpawterAvatar url="https://official.example/profile.jpg" testID="avatar" />); });
  const photo = r.root.findByProps({ testID: "avatar-photo" });
  await act(async () => { photo.props.onError(); });
  expect(r.root.findByProps({ testID: "avatar-moka" })).toBeDefined();
  await act(async () => { r.update(<SpawterAvatar url="https://official.example/new.jpg" testID="avatar" />); });
  expect(r.root.findByProps({ testID: "avatar-photo" })).toBeDefined();
  await act(async () => r.unmount());
});
