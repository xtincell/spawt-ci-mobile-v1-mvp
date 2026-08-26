// Simulation globale d'AsyncStorage.
//
// Le module natif n'existe pas sous Jest : toute suite qui importe — même
// indirectement — `src/lib/supabase.ts` échouait au chargement avec
// « NativeModule: AsyncStorage is null » depuis que le client Supabase déclare
// son adaptateur de stockage.
//
// Le mock officiel est posé ici plutôt que fichier par fichier : une dépendance
// transitive ne doit pas obliger chaque test à connaître la plomberie de la
// couche réseau. Les suites qui posent déjà leur propre mock gardent le leur.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
