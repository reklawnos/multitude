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

type ContextGenerators<T> = {
  [ContextKey in keyof T]: { [contextName: string]: () => T[ContextKey] };
};

function createContextsIterator<T extends object>(
  contextGenerators: ContextGenerators<T>,
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

function brokenThing(color: string, bold: boolean, italic: boolean) {
  let overrideColor = color;
  if (italic) {
    overrideColor = 'red';
  }

  return {
    color: overrideColor,
    bold,
    italic,
  };
}

function runInContexts<T, S>(contextsIterator: ContextsIterator<T>, getSubject: (context: T) => S, spec: (subject: S, context: T) => void) {
  const caughtErrors: [Error, {}][] = [];
  for (let value of contextsIterator) {
    try {
      spec(getSubject(value.context), value.context);
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

    caughtErrors[0][0].message = out;

    throw caughtErrors[0][0];
  }
}

enum TestItemType {
  WithSubject = 'WithSubject',
  WithContexts = 'WithContexts',
  Spec = 'Spec',
}

type WithSubjectItem<C, PS, S> = {
  type: TestItemType.WithSubject;
  name: string,
  subjectGenerator: (parentSubject: PS, context: C) => S;
  children: TestItem<C, S>[];
};

type WithContextsItem<C, PS> = {
  type: TestItemType.WithContexts;
  name: string;
  contextGeneratorMap: (cg: ContextGenerators<C>) => ContextGenerators<C>;
  children: TestItem<C, PS>[];
};

type SpecItem<C, PS> = {
  type: TestItemType.Spec;
  name: string,
  spec: (subject: PS, context: C) => void;
};


type TestItem<C, PS, S=any> =
  | WithSubjectItem<C, PS, S>
  | SpecItem<C, PS>
  | WithContextsItem<C, PS>;

function withSubject<C, ParentSubject = undefined, Subject = ParentSubject>(
  name: string,
  subjectGenerator: (parentSubject: ParentSubject, context: C) => Subject,
  tests: TestItem<C, Subject>[],
): WithSubjectItem<C, ParentSubject, Subject> {
  return {
    type: TestItemType.WithSubject,
    name,
    subjectGenerator,
    children: tests,
  };
}

function spec<C, ParentSubject>(
  name: string,
  f: (subject: ParentSubject, context: C) => void,
): SpecItem<C, ParentSubject> {
  return {
    type: TestItemType.Spec,
    name,
    spec: f,
  };
}

function runInUniverse<C extends object, S>(
  contextGenerators: ContextGenerators<C>,
  tests: TestItem<C, S>[],
  getSubject: (context: C) => S,
) {
  tests.forEach((test) => {
    switch (test.type) {
      case TestItemType.Spec: {
        it(test.name, () => {
          const contexts = createContextsIterator<C>(contextGenerators);
          runInContexts<C, S>(contexts, getSubject, test.spec);
        });
        break;
      }
      case TestItemType.WithSubject: {
        describe(test.name, () => {
          runInUniverse(contextGenerators, test.children, (context) => {
            return test.subjectGenerator(getSubject(context), context);
          });
        });
        break;
      }
      case TestItemType.WithContexts: {
        // TODO: should have a decent name
        describe(test.name, () => {
          runInUniverse(test.contextGeneratorMap(contextGenerators), test.children, getSubject);
        });
      }
    }
  });
}

function withUniverse<C extends object>(contextGenerators: ContextGenerators<C>, tests: TestItem<C, undefined>[]) {
  runInUniverse<C, undefined>(contextGenerators, tests, () => undefined);
}

function withContexts<C extends object, S>(
  name: string,
  mapper: (contextGenerators: ContextGenerators<C>) => ContextGenerators<C>,
  tests: TestItem<C, S>[],
): WithContextsItem<C, S> {
  return {
    type: TestItemType.WithContexts,
    name,
    contextGeneratorMap: mapper,
    children: tests,
  };
}

function fixAxes<C extends object>(
  contextGenerators: ContextGenerators<C>,
  axesValues: {
    [K in keyof C]?: string;
  },
) {
  // @ts-ignore
  const out = { ...contextGenerators } as any;

  Object.entries(axesValues).forEach(([key, contextItem]) => {
    out[key] = {
      [contextItem]: (contextGenerators as any)[key][contextItem],
    };
  });

  return out as ContextGenerators<C>;
}

withUniverse({
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
}, [
  withSubject('brokenThing', (s, c) => brokenThing(c.color, c.bold, c.italic), [
    withContexts('when red', gc => fixAxes(gc, { color: 'red' }), [
      withSubject('color', s => s.color, [
        spec('has the right color', (color, context) => {
          expect(color).toBe(context.color);
        }),
      ]),
    ]),

    withSubject('bold', s => s.bold, [
      spec('has the right boldness', (bold, context) => {
        expect(bold).toBe(context.bold);
      }),
    ]),

    withSubject('italic', s => s.italic, [
      spec('has the right italic-ness', (italic, context) => {
        expect(italic).toBe(context.italic);
      }),
    ]),
  ]),
]);
