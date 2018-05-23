// tslint:disable object-literal-key-quotes
import {
  universe,
  subject,
  withContexts,
  inv,
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

universe({
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
  subject('brokenThing', (s, c) => brokenThing(c.color, c.bold, c.italic), [
    subject('color', s => s.color, [
      withContexts('when red', gc => fixAxes(gc, { color: 'red' }), [
        inv('has the right color', (color, context) => {
          expect(color).toBe(context.color);
        }),
      ]),
    ]),

    subject('bold', s => s.bold, [
      inv('has the right boldness', (bold, context) => {
        expect(bold).toBe(context.bold);
      }),
    ]),

    subject('italic', s => s.italic, [
      inv('has the right italic-ness', (italic, context) => {
        expect(italic).toBe(context.italic);
      }),
    ]),

    inv('with promise good', () => {
      return Promise.resolve('foo');
    }),
  ]),
]);
