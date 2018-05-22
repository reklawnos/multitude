"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
function createContexts(contextGenerators) {
    const result = {};
    Object.entries(contextGenerators).forEach(([key, value]) => {
        const contextValues = {};
        Object.entries(value).forEach(([contextName, func]) => {
            contextValues[contextName] = func();
        });
        result[key] = contextValues;
    });
    return result;
}
const contexts = createContexts({
    color: {
        'red': () => 'red',
        'blue': () => 'blue',
        'green': () => 'green',
    },
    bold: {
        'bold': () => true,
        'not bold': () => false,
    },
    italic: {
        'italic': () => true,
        'not italic': () => false,
    },
});
console.log(contexts);
// type ContextItemOfContext
function doForContextMap(contextMap, currentContext, currentContextName, spec) {
    const keys = Object.keys(contextMap);
    if (keys.length === 0) {
        try {
            spec(currentContext);
        }
        catch (e) {
            const res = {
                context: currentContext,
                contextName: currentContextName,
                error: e,
            };
            return [res];
        }
        return [];
    }
    const prop = keys[0];
    const _a = prop, contexts = contextMap[_a], 
    // @ts-ignore
    rest = __rest(contextMap, [typeof _a === "symbol" ? _a : _a + ""]);
    return Object.entries(contexts).reduce((allErrors, [contextName, contextValue]) => [
        ...allErrors,
        ...doForContextMap(rest, Object.assign({}, currentContext, { [prop]: contextValue }), currentContextName + `when ${contextName} `, spec),
    ], []);
}
function doForContexts(contextMap, spec) {
    doForContextMap(contextMap, {}, '', spec);
}
function brokenThing(color, bold, italic) {
    if (italic) {
        return 'red';
    }
    return color;
}
it('it has a thing', () => {
    doForContexts(contexts, (contex) => {
        expect(brokenThing(context.color, context.bold, context.italic)).toBe(context.color);
    });
});
//# sourceMappingURL=index.test.js.map