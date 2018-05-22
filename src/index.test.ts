function createContexts<T extends object>(
  contextGenerators: {
    [ContextKey in keyof T]: { [contextName: string]: () => T[ContextKey] };
  },
) {
  const result: { [k: string]: any } = {};

  Object.entries(contextGenerators).forEach(([key, value]) => {
    const contextValues: { [k: string]: any } = {};

    Object.entries(value).forEach(([contextName, func]) => {
      contextValues[contextName] = func();
    });

    result[key] = contextValues;
  });

  return result as ;
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

interface ErrorInContext<T> {
  error: Error;
  context: T;
  contextName: string;
}

type ContextsType = { [k: string]: { [k: string]: any } };

type MapValueOf<T extends { [k: string]: any }> = T extends { [k: string]: infer U }
  ? U
  : never;

type ValuesOf<T extends ContextsType> = {
  [K in keyof T]: MapValueOf<T[K]>;
};

// type ContextItemOfContext

function doForContextMap<T extends ContextsType>(
  contextMap: T,
  currentContext: Partial<ValuesOf<T>>,
  currentContextName: string,
  spec: (context: T) => any,
): ErrorInContext<T>[] {
  const keys = Object.keys(contextMap);

  if (keys.length === 0) {
    try {
      spec(currentContext as ValuesOf<T>);
    } catch (e) {
      const res: ErrorInContext<T> = {
        context: currentContext as any,
        contextName: currentContextName,
        error: e as Error,
      };
      return [res];
    }

    return [];
  }

  const prop = keys[0];

  const {
    [prop]: contexts,
    // @ts-ignore
    ...rest,
  } = contextMap;

  return Object.entries(contexts).reduce((allErrors: ErrorInContext<T>[], [contextName, contextValue]) => [
    ...allErrors,
    ...doForContextMap(
      rest,
      // @ts-ignore
      { ...currentContext, [prop]: contextValue },
      currentContextName + `when ${contextName} `,
      spec,
    ),
  ], []);
}

function doForContexts<T extends ContextsType>(contextMap: T, spec: (context: T) => any) {
  doForContextMap(contextMap, {}, '', spec);
}

function brokenThing(color: string, bold: boolean, italic: boolean): string {
  if (italic) {
    return 'red';
  }
  return color;
}

it ('it has a thing', () => {
  doForContexts(contexts, (contex: ValuesOf<typeof contexts>) => {
    expect(brokenThing(context.color, context.bold, context.italic)).toBe(context.color);
  });
});
