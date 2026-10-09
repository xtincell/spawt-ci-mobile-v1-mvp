import { getRouteGuardDecision } from "../../src/lib/route-guard";

it("attend la restauration avant de refuser un lien vers l'historique, puis laisse entrer le compte retrouvé", () => {
  expect(getRouteGuardDecision({ firstSegment: "spawts", hydrating: true, hasSpawter: false })).toEqual({ ready: false });
  expect(getRouteGuardDecision({ firstSegment: "spawts", hydrating: false, hasSpawter: true })).toEqual({ ready: true });
});

it("renvoie à l'accueil une session fermée sur l'historique ou un formulaire d'avis", () => {
  expect(getRouteGuardDecision({ firstSegment: "spawts", hydrating: false, hasSpawter: false })).toEqual({ ready: false, redirect: "/" });
  expect(getRouteGuardDecision({ firstSegment: "review", hydrating: false, hasSpawter: false })).toEqual({ ready: false, redirect: "/" });
});

it("garde les fiches publiques et l'inscription accessibles hors session", () => {
  expect(getRouteGuardDecision({ firstSegment: "place", hydrating: false, hasSpawter: false })).toEqual({ ready: true });
  expect(getRouteGuardDecision({ firstSegment: "(onboarding)", hydrating: false, hasSpawter: false })).toEqual({ ready: true });
});

it("masque l'accueil initial jusqu'au routage du compte connecté vers ses onglets", () => {
  expect(getRouteGuardDecision({ firstSegment: undefined, hydrating: false, hasSpawter: true })).toEqual({ ready: false, redirect: "/(tabs)" });
  expect(getRouteGuardDecision({ firstSegment: "(tabs)", hydrating: false, hasSpawter: true })).toEqual({ ready: true });
});
