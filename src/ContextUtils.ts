interface ContextValue<T> {
  context: T;
  contextNames: {
    [K in keyof T]: string;
  };
}

export interface ContextsIterator<T> {
  [Symbol.iterator]: () => {
    next: () => {
      done: boolean,
      value: ContextValue<T>,
    };
  };
}

export type ContextGenerators<T> = {
  [ContextKey in keyof T]: { [contextName: string]: () => T[ContextKey] };
};

export function createContextsIterator<T extends object>(
  contextGenerators: ContextGenerators<T>,
): ContextsIterator<T> {
  const contextGeneratorLists = Object.entries(contextGenerators)
    .map(([key, value]) => [
      key, Object.entries(value),
    ])
    .filter(([key, value]) => value.length > 0) as Array<[string, [string, any[]]]>;

  const valueFromIndex = (index: number) => {
    const outputContext: { [k: string]: any } = {};
    const outputContextNames: { [k: string]: string } = {};

    let lenProduct = 1;
    contextGeneratorLists.forEach(([key, options], i) => {
      const optionsIndex = Math.floor(index / lenProduct) % options.length;
      const [contextName, contextGenerator] = options[optionsIndex];
      lenProduct *= options.length;
      outputContext[key] = contextGenerator();
      outputContextNames[key] = contextName;
    });

    return {
      context: outputContext,
      contextNames: outputContextNames,
    } as ContextValue<T>;
  };

  const numItems = contextGeneratorLists.reduce((product, [key, options]) => (
    product * options.length
  ), 1);

  const getIterator = () => {
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
