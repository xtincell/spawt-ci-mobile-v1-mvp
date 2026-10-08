import AsyncStorage from "@react-native-async-storage/async-storage";
import { SAMPLE_SPAWTER, EMPTY_PALAIS } from "../../data/seed/sample-spawter";
import { loadSpawter, saveRecoveredAccountLocal } from "../storage";
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
it("une panne après écriture du Palais ne publie jamais l'ancien profil", async () => {
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify({ ...SAMPLE_SPAWTER, id: "ancien-compte" }));
  const write = AsyncStorage.setItem as jest.Mock;
  const original = write.getMockImplementation()!;
  write.mockImplementationOnce(original).mockRejectedValueOnce(new Error("quota"));
  await expect(saveRecoveredAccountLocal(SAMPLE_SPAWTER, EMPTY_PALAIS)).rejects.toThrow("quota");
  expect(JSON.parse((await AsyncStorage.getItem("spawt:palais"))!)).toEqual(EMPTY_PALAIS);
  expect(await loadSpawter()).toBeNull();
  await saveRecoveredAccountLocal(SAMPLE_SPAWTER, EMPTY_PALAIS);
  expect(await loadSpawter()).toEqual(SAMPLE_SPAWTER);
});
it("une déconnexion entre deux écritures interrompt la publication", async () => {
  let current = true;
  const write = AsyncStorage.setItem as jest.Mock;
  const original = write.getMockImplementation()!;
  write.mockImplementationOnce(async (...args: unknown[]) => { await original(...args); current = false; });
  await expect(saveRecoveredAccountLocal(SAMPLE_SPAWTER, EMPTY_PALAIS, () => current)).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  expect(await loadSpawter()).toBeNull();
});
it("une paire de comptes différents ne produit aucune écriture", async () => {
  await expect(saveRecoveredAccountLocal(SAMPLE_SPAWTER, { ...EMPTY_PALAIS, spawter_id: "autre" })).rejects.toThrow("ACCOUNT_INVALID");
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});
