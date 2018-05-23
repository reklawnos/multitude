import {
  createContextsIterator,
  ContextsIterator,
  ContextGenerators,
} from './ContextUtils';

export enum TestItemType {
  WithSubject = 'WithSubject',
  WithContexts = 'WithContexts',
  Invariant = 'Invariant',
}

export type WithSubjectItem<C, PS, S> = {
  type: TestItemType.WithSubject;
  name: string,
  subjectGenerator: (parentSubject: PS, context: C) => S;
  children: TestItem<C, S>[];
};

export type WithContextsItem<C, PS> = {
  type: TestItemType.WithContexts;
  name: string;
  contextGeneratorMap: (cg: ContextGenerators<C>) => ContextGenerators<C>;
  children: TestItem<C, PS>[];
};

export type InvariantItem<C, PS> = {
  type: TestItemType.Invariant;
  name: string,
  spec: (subject: PS, context: C) => void;
};

export type TestItem<C, PS, S = any> =
  | WithSubjectItem<C, PS, S>
  | WithContextsItem<C, PS>
  | InvariantItem<C, PS>;


export function universe<C extends object>(
  contextGenerators: ContextGenerators<C>,
  tests: TestItem<C, undefined>[],
) {
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

export function subject<C, ParentSubject = undefined, Subject = ParentSubject>(
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

export function inv<C, ParentSubject>(
  name: string,
  f: (subject: ParentSubject, context: C) => void,
): InvariantItem<C, ParentSubject> {
  return {
    type: TestItemType.Invariant,
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
      case TestItemType.Invariant: {
        it(test.name, () => {
          const contexts = createContextsIterator<C>(contextGenerators);
          return runInContexts<C, S>(contexts, getSubject, test.spec);
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
        describe(test.name, () => {
          runInUniverse(test.contextGeneratorMap(contextGenerators), test.children, getSubject);
        });
      }
    }
  });
}

function runInContexts<T, S>(
  contextsIterator: ContextsIterator<T>,
  getSubject: (context: T) => S,
  specFunc: ((subject: S, context: T) => void)
    | ((subject: S, context: T) => Promise<any>),
) {
  const caughtErrors: [Error, {}][] = [];
  const remainingPromises: Promise<any>[] = [];
  for (const value of contextsIterator) {
    try {
      const promise = specFunc(getSubject(value.context), value.context);
      if (promise) {
        remainingPromises.push(promise.catch((e) => {
          caughtErrors.push([e, value.contextNames]);
        }));
      }
    } catch (e) {
      caughtErrors.push([e, value.contextNames]);
    }
  }

  const doThrow = () => {
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
  };

  if (remainingPromises.length <= 0) {
    doThrow();
  } else {
    return Promise.all(remainingPromises).then(() => {
      doThrow();
    });
  }
}
