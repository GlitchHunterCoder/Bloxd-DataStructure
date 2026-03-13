# Bloxd-DataStructure

<details>

<summary>

## Documentation

</summary>

### Overview

DS is a single-file JavaScript framework for designing, testing, and benchmarking data structures. It models all structures as graphs of nodes and measures structural cost — how many interactions an operation performs on the graph — rather than general computation cost.

**Core rule: all state lives on the structure. Nothing is hidden.**

---

### Getting Started

```js
const { ctx, benchmark } = DS.createStructure()

// Build your initial structure
const n1 = ctx.node("a")
const n2 = ctx.node("b")
ctx.set(ctx.root, "next", n1)
ctx.set(n1, "next", n2)

// Define an operation
function traverse(ctx) {
  let current = ctx.root
  while (ctx.get(current, "next")) {
    current = ctx.get(current, "next")
  }
  return current
}

// Benchmark it
const report = benchmark.run(traverse)
// { gets: 4, sets: 0, deletes: 0, nodes: 0 }
```

---

### API Reference

#### `DS.createStructure(costFn?)`

Creates a new framework instance. Returns `{ ctx, benchmark, ledger }`.

`costFn` is an optional custom cost function — see Custom Cost Models below.

---

#### `DS.VALUE`

A public Symbol used as the key for a node's stored value.

```js
ctx.get(node, DS.VALUE)   // read node's value
ctx.set(node, DS.VALUE, 42) // write node's value
```

---

#### CTX

The tracked operator. All interactions with the graph go through ctx. It is stateless — it holds no position or cursor.

- `ctx.root`

The entry point to the structure. Always node 0 in the ledger. Every structure starts here.

- `ctx.node(value)`

Creates a new node with the given value, adds it to the ledger, and returns a reference to it. Counted in the benchmark as a `node` action.

```js
const n = ctx.node(42)
```

- `ctx.get(node, key)`

Returns the value at `key` on the given node. Key can be a string reference key or `DS.VALUE` for the node's stored value. Counted as a `get`.

```js
ctx.get(node, "next")       // get child reference
ctx.get(node, DS.VALUE)     // get stored value
```

- `ctx.set(node, key, value)`

Sets the value at `key` on the given node. Used both for storing values and linking nodes together. Counted as a `set`.

```js
ctx.set(node, "next", otherNode)  // link nodes
ctx.set(node, DS.VALUE, 99)       // update value
```

- `ctx.delete(node, key)`

Removes a key from the given node entirely. Counted as a `delete`.

```js
ctx.delete(node, "next")
```

---

#### Benchmark

- `benchmark.run(operation, ...args)`

Runs the operation, records all structural interactions, and returns a report. The framework passes `ctx` as the first argument to the operation automatically — do not pass it yourself.

```js
function myOp(ctx, x) { ... }
benchmark.run(myOp, x)  // ctx is injected, x is passed through
```

**Default report:**
```js
{ gets: 3, sets: 1, deletes: 0, nodes: 2 }
```

**Debug mode** — pass `DS.runOptions({ debug: true, returnValue: true })` as the last argument:

```js
benchmark.run(myOp, x, DS.runOptions({ debug: true, returnValue: true }))
// {
//   gets: 3, sets: 1, deletes: 0, nodes: 2,
//   returnValue: ...,
//   log: [
//     { type: 'get', key: 'next', value: undefined, timestamp: 0 },
//     ...
//   ]
// }
```

---

### Node Structure

Every node is a plain object:

```js
{
  [DS.VALUE]: storedValue,  // the node's data, keyed by symbol
  next: otherNode,          // named references to other nodes
  left: anotherNode,
  // ...any keys you define
}
```

The VALUE symbol ensures the node's data and its structural references never collide, even if you use a key named `"value"`.

---

### The Ledger

All nodes created via `ctx.node()` are stored in an internal list. Node 0 is always `ctx.root`. You never interact with the ledger directly — it exists so the framework has a complete picture of every allocated node.

---

### Managing Position

ctx has no cursor. If you need to remember where you are in the structure, you must build that into the structure itself using pointer nodes.

```js
// Store a tail pointer on the structure
const meta = ctx.node(null)
ctx.set(ctx.root, "meta", meta)
ctx.set(meta, "tail", lastNode)

// Later — jump straight to tail
const tail = ctx.get(ctx.get(ctx.root, "meta"), "tail")
```

This is intentional. The cost of tracking multiple positions shows up in your structure and your benchmark report — nothing is hidden.

---

### Custom Cost Models

Pass a cost function to `createStructure` to define your own cost model:

```js
const { ctx, benchmark } = DS.createStructure(function(type, node, key, value, counters) {
  // type: 'get' | 'set' | 'delete' | 'node'
  // counters: { gets, sets, deletes, nodes } — mutate directly
  if (type === 'get') counters.gets += 5   // weight reads more heavily
})
```

The cost function runs after default counting. You can override or augment the default counters however you like.

---

### Example: Linked List with Tail Pointer

```js
const { ctx, benchmark } = DS.createStructure()

// Build: root → n1 → n2, with meta.tail pointing to n2
const meta = ctx.node(null)
const n1 = ctx.node("a")
const n2 = ctx.node("b")
ctx.set(ctx.root, "meta", meta)
ctx.set(ctx.root, "next", n1)
ctx.set(n1, "next", n2)
ctx.set(meta, "tail", n2)

// O(1) append using tail pointer
function append(ctx, value) {
  const meta = ctx.get(ctx.root, "meta")
  const tail = ctx.get(meta, "tail")
  const newNode = ctx.node(value)
  ctx.set(tail, "next", newNode)
  ctx.set(meta, "tail", newNode)
}

const report = benchmark.run(append, "c")
// { gets: 2, sets: 2, deletes: 0, nodes: 1 }
// Constant cost regardless of list length — the tail pointer paid off
```

---

### Core Principle

> **If you want faster operations, you must pay for it with structure.**

Tail pointers, parent references, size metadata — none of this is free. The framework makes that cost explicit and measurable.

</details>

<details>

<summary>

## Example Data Types

</summary>

### Linked List
#### append WITHOUT tail pointer (O(n))
```js
const { ctx, benchmark } = DS.createStructure()

// Build: root → a → b → c
const a = ctx.node("a")
const b = ctx.node("b")
const c = ctx.node("c")
ctx.set(ctx.root, "next", a)
ctx.set(a, "next", b)
ctx.set(b, "next", c)

function append(ctx, value) {
  let current = ctx.root
  while (ctx.get(current, "next")) {
    current = ctx.get(current, "next")
  }
  const newNode = ctx.node(value)
  ctx.set(current, "next", newNode)
}

const report = benchmark.run(append, "d")
console.log('Appended "d" to list of length 3')
console.log(report)
// gets will scale with list length — O(n)
```
#### append WITH tail pointer (O(1))
```js
const { ctx, benchmark } = DS.createStructure()

// Build: root → a → b → c, meta.tail → c
const meta = ctx.node(null)
const a = ctx.node("a")
const b = ctx.node("b")
const c = ctx.node("c")
ctx.set(ctx.root, "meta", meta)
ctx.set(ctx.root, "next", a)
ctx.set(a, "next", b)
ctx.set(b, "next", c)
ctx.set(meta, "tail", c)

function append(ctx, value) {
  const meta = ctx.get(ctx.root, "meta")
  const tail = ctx.get(meta, "tail")
  const newNode = ctx.node(value)
  ctx.set(tail, "next", newNode)
  ctx.set(meta, "tail", newNode)
}

const report = benchmark.run(append, "d")
console.log('Appended "d" to list of length 3')
console.log(report)
// gets stays constant regardless of list length — O(1)
```

</details>
