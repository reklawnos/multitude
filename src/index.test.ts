import {
  withUniverse,
  withSubject,
  withContexts,
  spec,
  fixAxes,
} from './index';

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
