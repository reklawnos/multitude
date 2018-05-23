import {
  createContextsIterator,
  ContextValue,
  ContextsIterator,
  ContextGenerators,
} from './ContextUtils';

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
  | WithContextsItem<C, PS>
  | SpecItem<C, PS>;


export function withUniverse<C extends object>(contextGenerators: ContextGenerators<C>, tests: TestItem<C, undefined>[]) {
  runInUniverse<C, undefined>(contextGenerators, tests, () => undefined);
}

export function withContexts<C extends object, S>(
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

export function withSubject<C, ParentSubject = undefined, Subject = ParentSubject>(
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

export function spec<C, ParentSubject>(
  name: string,
  f: (subject: ParentSubject, context: C) => void,
): SpecItem<C, ParentSubject> {
  return {
    type: TestItemType.Spec,
    name,
    spec: f,
  };
}

export function fixAxes<C extends object>(
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
