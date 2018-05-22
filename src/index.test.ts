interface ContextValue<T> {
  context: T;
  contextNames: {
    [K in keyof T]: string;
  };
}

interface ContextsIterator<T> {
  [Symbol.iterator]: () => {
    next: () => {
      done: boolean,
      value: ContextValue<T>,
    };
  };
}

function createContextsIterator<T extends object>(
  contextGenerators: {
    [ContextKey in keyof T]: { [contextName: string]: () => T[ContextKey] };
  },
): ContextsIterator<T> {
  const contextGeneratorLists = Object.entries(contextGenerators)
    .map(([key, value]) => [
      key, Object.entries(value),
    ])
    .filter(([key, value]) => value.length > 0) as [string, [string, any[]]][];

  const valueFromIndex = (index: number) => {
    const outputContext: { [k: string]: any } = {};
    const outputContextNames: { [k: string]: string } = {};

    let lenProduct = 1;
    contextGeneratorLists.forEach(([key, options], i) => {
      const [contextName, contextGenerator] = options[Math.floor(index / lenProduct) % options.length];
      lenProduct *= options.length;
      outputContext[key] = contextGenerator();
      outputContextNames[key] = contextName;
    });

    return {
      context: outputContext,
      contextNames: outputContextNames,
    } as ContextValue<T>;
  };

  const numItems = contextGeneratorLists.reduce((product, [key, options]) => product * options.length, 1);

  const getIterator = () => {
    const contextGeneratorIndices = contextGeneratorLists.map(() => 0);

    let index = 0;

    const next = () => {
      if (index >= numItems) {
        return {
          done: true,
          value: (undefined as any) as {
            context: T;
            contextNames: {
              [K in keyof T]: string;
            };
          },
        };
      }
      const res = {
        value: valueFromIndex(index),
        done: false,
      };

      index += 1;

      return res;
    };

    return {
      next,
    };
  };

  return {
    [Symbol.iterator]: getIterator,
  };
}

const contexts = createContextsIterator({
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

function brokenThing(color: string, bold: boolean, italic: boolean): string {
  if (italic) {
    return 'red';
  }
  return color;
}

function runInContexts<T>(contextsIterator: ContextsIterator<T>, spec: (context: T) => void) {
  const caughtErrors: [Error, {}][] = [];
  for (let value of contextsIterator) {
    try {
      spec(value.context);
    } catch(e) {
      caughtErrors.push([e, value.contextNames]);
    }
  }
  if (caughtErrors.length > 0) {
    let out = '';
    caughtErrors.forEach(([e, contextNames]) => {
      out += 'When:\n';
      const lines = Object.entries(contextNames)
        .map(([key, name]) => `• ${key} is ${name}`);
      out += lines.join('\n') + '\n\n';
      out += e.message + '\n\n\n';
    });
    throw new Error(out);
  }
}

it('does a thing', () => {
  runInContexts(contexts, (context) => {
    const { color, bold, italic } = context;
    expect(brokenThing(color, bold, italic)).toBe(color);
  });
});


/*
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

*/
