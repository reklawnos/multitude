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

enum TestItemType {
  WithSubject = 'WithSubject',
  Spec = 'Spec',
}

type WithSubjectItem<C, PS, S> = {
  type: TestItemType.WithSubject;
  name: string,
  subjectGenerator: (context: C, parentSubject: PS) => S;
  children: TestItem<C, S>[];
};

type SpecItem<C, PS> = {
  type: TestItemType.Spec;
  name: string,
  spec: (subject: PS) => void;
};

type TestItem<C, PS, S=any> =
  | WithSubjectItem<C, PS, S>
  | SpecItem<C, PS>;

function withSubject<C, ParentSubject = undefined, Subject = ParentSubject>(
  name: string,
  subjectGenerator: (context: C, parentSubject: ParentSubject) => Subject,
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
  f: (subject: ParentSubject) => void,
): SpecItem<C, ParentSubject> {
  return {
    type: TestItemType.Spec,
    name,
    spec: f,
  };
}

function withContexts<C>(contextGenerators: ContextGenerators<C>, tests: TestItem<C, undefined>[]) {
  const contexts = createContextsIterator(contextGenerators);

  return tests;
}

const res = withContexts({
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
  withSubject('test', c => null, [
    spec('wow', () => {}),

    withSubject('null to string', (c, s) => c.color, [
      spec('hi', (s: string) => {}),

      withSubject('string to num', (c, s) => c.bold ? 3 : 0, [
        spec('hi', (s: number) => {}),
      ]),
    ]),
  ]),
]);
console.log(
  res,
);

it('does a thing', () => {
  runInContexts(contexts, (context) => {
    const { color, bold, italic } = context;
    expect(brokenThing(color, bold, italic)).toBe(color);
  });
});

/*
describe('test', [
  describe('wow', [
    it('does a thing', () => {
    }),
  ]),
]);
*/
