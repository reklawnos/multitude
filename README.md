# Multitude

### Example:
```typescript
import { universe, subject, inv } from 'multitude';

// Example (broken) function to test
function brokenThing(color: string, bold: boolean) {
  let overrideColor = color;

  // Artificial bug here (this should always return `color`)
  if (bold) {
    overrideColor = 'red';
  }

  return {
    color: overrideColor,
    bold,
  };
}

// Possible values for each context property
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
}, [
  subject('brokenThing', (s, c) => brokenThing(c.color, c.bold), [
    subject('color', s => s.color, [
      inv('has the right color', (color, context) => {

        // This test fails, since we return red when `bold` is `true`
        expect(color).toBe(context.color);
      }),
    ]),

    subject('bold', s => s.bold, [
      inv('has the right boldness', (bold, context) => {
        expect(bold).toBe(context.bold);
      }),
    ]),
  ]),
]);
```
