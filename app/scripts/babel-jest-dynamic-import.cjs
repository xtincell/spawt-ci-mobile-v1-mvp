// Jest CommonJS : les imports différés passent par le même registre de mocks.
// Expo/Metro garde ses imports natifs ; ce plugin n'est activé qu'en test.
module.exports = ({ types: t }) => ({
  visitor: {
    CallExpression(path, state) {
      if (path.node.callee.type !== "Import") return;
      const resolve = t.callExpression(t.memberExpression(t.identifier("Promise"), t.identifier("resolve")), []);
      path.replaceWith(t.callExpression(t.memberExpression(resolve, t.identifier("then")), [
        t.arrowFunctionExpression([], t.callExpression(state.addHelper("interopRequireWildcard"), [
          t.callExpression(t.identifier("require"), path.node.arguments),
        ])),
      ]));
    },
  },
});
