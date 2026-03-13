# Bloxd-DataStructure

<details><summary>

## Documentation</summary>

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

<details><summary>

## Example Data Types</summary>

<details><summary>

### 1. Stack</summary>

```js
// A stack is a linked list where push and pop both operate at the head.
// Structure: root.top → node → node → node
// No tail pointer needed — all operations are O(1) at the head.
```
#### push x3, pop x1
```js
const { ctx, benchmark } = DS.createStructure()

// root holds a "top" reference and a size counter node
const size = ctx.node(0)
ctx.set(ctx.root, "size", size)

function push(ctx, value) {
  const newNode = ctx.node(value)
  const oldTop = ctx.get(ctx.root, "top")
  ctx.set(newNode, "next", oldTop)
  ctx.set(ctx.root, "top", newNode)
  const size = ctx.get(ctx.root, "size")
  ctx.set(size, VALUE, ctx.get(size, VALUE) + 1)
}

function pop(ctx) {
  const top = ctx.get(ctx.root, "top")
  if (!top) return
  const next = ctx.get(top, "next")
  ctx.set(ctx.root, "top", next)
  const size = ctx.get(ctx.root, "size")
  ctx.set(size, VALUE, ctx.get(size, VALUE) - 1)
}

console.log('    push "a":', benchmark.run(push, "a"))
console.log('    push "b":', benchmark.run(push, "b"))
console.log('    push "c":', benchmark.run(push, "c"))
console.log('    pop:     ', benchmark.run(pop))
```

</details>

<details><summary>

### 2. Queue</summary>

```js
// Queue needs both head (dequeue) and tail (enqueue) pointers for O(1) ops.
// Without tail pointer, enqueue is O(n).
// Structure: root.head → node → node → node ← root.tail
```
#### enqueue x3, dequeue x1
```js
const { ctx, benchmark } = DS.createStructure()

function enqueue(ctx, value) {
  const newNode = ctx.node(value)
  const tail = ctx.get(ctx.root, "tail")
  if (!tail) {
    ctx.set(ctx.root, "head", newNode)
    ctx.set(ctx.root, "tail", newNode)
  } else {
    ctx.set(tail, "next", newNode)
    ctx.set(ctx.root, "tail", newNode)
  }
}

function dequeue(ctx) {
  const head = ctx.get(ctx.root, "head")
  if (!head) return
  const next = ctx.get(head, "next")
  ctx.set(ctx.root, "head", next)
  if (!next) ctx.set(ctx.root, "tail", null)
}

console.log('    enqueue "a":', benchmark.run(enqueue, "a"))
console.log('    enqueue "b":', benchmark.run(enqueue, "b"))
console.log('    enqueue "c":', benchmark.run(enqueue, "c"))
console.log('    dequeue:    ', benchmark.run(dequeue))
```

</details>

<details><summary>

### 3. Doubly linked list</summary>

```js
// Each node holds both next and prev references.
// Deletion of a known node is O(1) since no traversal is needed.
// Structure: root.head ⇄ node ⇄ node ⇄ node, root.tail → last node
```
#### append x3, delete middle node
```js
const { ctx, benchmark } = DS.createStructure()

function append(ctx, value) {
  const newNode = ctx.node(value)
  const tail = ctx.get(ctx.root, "tail")
  if (!tail) {
    ctx.set(ctx.root, "head", newNode)
    ctx.set(ctx.root, "tail", newNode)
  } else {
    ctx.set(tail, "next", newNode)
    ctx.set(newNode, "prev", tail)
    ctx.set(ctx.root, "tail", newNode)
  }
}

// Delete a known node directly — no traversal needed
function deleteNode(ctx, node) {
  const prev = ctx.get(node, "prev")
  const next = ctx.get(node, "next")
  if (prev) ctx.set(prev, "next", next)
  else ctx.set(ctx.root, "head", next)
  if (next) ctx.set(next, "prev", prev)
  else ctx.set(ctx.root, "tail", prev)
}

benchmark.run(append, "a")
const reportB = benchmark.run(append, "b")  // save b for deletion
benchmark.run(append, "c")

// Grab the middle node reference directly (b is ledger node index 2)
const { ledger } = DS.createStructure()  // just to show concept
// In practice the user would hold the reference from ctx.node() return value
// Here we reach into ctx.root chain manually outside benchmark to get b
const b = ctx.root.head.next  // raw access just to get the reference for demo

console.log('    append "a":', benchmark.run(append, "a"))
console.log('    append "b":', benchmark.run(append, "b"))
console.log('    append "c":', benchmark.run(append, "c"))
```
#### append x3, delete middle node (holding reference)
```js
const { ctx, benchmark } = DS.createStructure()

function append(ctx, value) {
  const newNode = ctx.node(value)
  const tail = ctx.get(ctx.root, "tail")
  if (!tail) {
    ctx.set(ctx.root, "head", newNode)
    ctx.set(ctx.root, "tail", newNode)
  } else {
    ctx.set(tail, "next", newNode)
    ctx.set(newNode, "prev", tail)
    ctx.set(ctx.root, "tail", newNode)
  }
  return newNode
}

function deleteNode(ctx, node) {
  const prev = ctx.get(node, "prev")
  const next = ctx.get(node, "next")
  if (prev) ctx.set(prev, "next", next)
  else ctx.set(ctx.root, "head", next)
  if (next) ctx.set(next, "prev", prev)
  else ctx.set(ctx.root, "tail", prev)
}

// Setup outside benchmark (not measured)
const a = ctx.node("a")
const b = ctx.node("b")
const c = ctx.node("c")
ctx.set(ctx.root, "head", a)
ctx.set(ctx.root, "tail", c)
ctx.set(a, "next", b)
ctx.set(b, "prev", a)
ctx.set(b, "next", c)
ctx.set(c, "prev", b)

// Delete b — O(1) because we have the reference
console.log('    delete known node "b":', benchmark.run(deleteNode, b))
```

</details>

<details><summary>

### 4. Binary search tree</summary>

```js
// Each node has left and right children.
// Insert and lookup are O(log n) for balanced trees, O(n) worst case.
// Structure: root.tree → node with left/right children
```
#### insert x5, lookup
```js
const { ctx, benchmark } = DS.createStructure()

function insert(ctx, value) {
  const newNode = ctx.node(value)
  if (!ctx.get(ctx.root, "tree")) {
    ctx.set(ctx.root, "tree", newNode)
    return
  }
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(ctx.root, "tree"))
  while (true) {
    const curr = ctx.get(ptr, "curr")
    const currVal = ctx.get(curr, VALUE)
    if (value < currVal) {
      const left = ctx.get(curr, "left")
      if (!left) { ctx.set(curr, "left", newNode); return }
      ctx.set(ptr, "curr", left)
    } else {
      const right = ctx.get(curr, "right")
      if (!right) { ctx.set(curr, "right", newNode); return }
      ctx.set(ptr, "curr", right)
    }
  }
}

function lookup(ctx, value) {
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(ctx.root, "tree"))
  while (ctx.get(ptr, "curr")) {
    const curr = ctx.get(ptr, "curr")
    const currVal = ctx.get(curr, VALUE)
    if (value === currVal) return true
    if (value < currVal) ctx.set(ptr, "curr", ctx.get(curr, "left"))
    else ctx.set(ptr, "curr", ctx.get(curr, "right"))
  }
  return false
}

// Build tree: 5, 3, 7, 2, 4
//        5
//       / \
//      3   7
//     / \
//    2   4
console.log('    insert 5:', benchmark.run(insert, 5))
console.log('    insert 3:', benchmark.run(insert, 3))
console.log('    insert 7:', benchmark.run(insert, 7))
console.log('    insert 2:', benchmark.run(insert, 2))
console.log('    insert 4:', benchmark.run(insert, 4))
console.log('    lookup 4:', benchmark.run(lookup, 4, DS.runOptions({ returnValue: true })))
console.log('    lookup 9:', benchmark.run(lookup, 9, DS.runOptions({ returnValue: true })))
```

</details>

<details><summary>

### 5. Trie</summary>

```js
// Each node's children are keyed by characters.
// Insert and lookup are O(k) where k is the length of the string.
// Structure: root → char nodes → char nodes → ... → terminal node
```
#### insert "cat", "car", "dog" — lookup "cat", "ca", "dog"
```js
const { ctx, benchmark } = DS.createStructure()

function insert(ctx, word) {
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.root)
  for (const char of word) {
    const curr = ctx.get(ptr, "curr")
    if (!ctx.get(curr, char)) {
      ctx.set(curr, char, ctx.node(null))
    }
    ctx.set(ptr, "curr", ctx.get(curr, char))
  }
  // Mark end of word
  ctx.set(ctx.get(ptr, "curr"), "end", true)
}

function lookup(ctx, word) {
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.root)
  for (const char of word) {
    const curr = ctx.get(ptr, "curr")
    const next = ctx.get(curr, char)
    if (!next) return false
    ctx.set(ptr, "curr", next)
  }
  return ctx.get(ctx.get(ptr, "curr"), "end") === true
}

console.log('    insert "cat":', benchmark.run(insert, "cat"))
console.log('    insert "car":', benchmark.run(insert, "car"))
console.log('    insert "dog":', benchmark.run(insert, "dog"))
console.log('    lookup "cat":', benchmark.run(lookup, "cat", DS.runOptions({ returnValue: true })))
console.log('    lookup "ca" :', benchmark.run(lookup, "ca",  DS.runOptions({ returnValue: true })))
console.log('    lookup "dog":', benchmark.run(lookup, "dog", DS.runOptions({ returnValue: true })))
```

</details>

<details><summary>

### 6. Hash map (separate chaining)</summary>

```js
// Fixed number of bucket nodes off root. Collisions handled by chaining
// linked lists off each bucket. Keys are hashed to a bucket index.
// Lookup is O(1) average, O(n) worst case (all keys in one bucket).
```
#### set x4, get x2
```js
const { ctx, benchmark } = DS.createStructure()
const BUCKET_COUNT = 8

// Build bucket nodes off root
const buckets = []
for (let i = 0; i < BUCKET_COUNT; i++) {
  const b = ctx.node(null)
  ctx.set(ctx.root, `b${i}`, b)
  buckets.push(b)
}

function hash(key) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % BUCKET_COUNT
  return h
}

function set(ctx, key, value) {
  const idx = hash(key)
  const bucket = ctx.get(ctx.root, `b${idx}`)
  // Walk chain to check for existing key
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(bucket, "head"))
  while (ctx.get(ptr, "curr")) {
    const curr = ctx.get(ptr, "curr")
    if (ctx.get(curr, "key") === key) {
      ctx.set(curr, "val", value)
      return
    }
    ctx.set(ptr, "curr", ctx.get(curr, "next"))
  }
  // Not found — prepend new entry node
  const entry = ctx.node(null)
  ctx.set(entry, "key", key)
  ctx.set(entry, "val", value)
  ctx.set(entry, "next", ctx.get(bucket, "head"))
  ctx.set(bucket, "head", entry)
}

function get(ctx, key) {
  const idx = hash(key)
  const bucket = ctx.get(ctx.root, `b${idx}`)
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(bucket, "head"))
  while (ctx.get(ptr, "curr")) {
    const curr = ctx.get(ptr, "curr")
    if (ctx.get(curr, "key") === key) return ctx.get(curr, "val")
    ctx.set(ptr, "curr", ctx.get(curr, "next"))
  }
  return undefined
}

console.log('    set "name","Alice":', benchmark.run(set, "name", "Alice"))
console.log('    set "age", 30:    ', benchmark.run(set, "age", 30))
console.log('    set "city","Oslo":', benchmark.run(set, "city", "Oslo"))
console.log('    set "name","Bob": ', benchmark.run(set, "name", "Bob"))  // update
console.log('    get "name":       ', benchmark.run(get, "name", DS.runOptions({ returnValue: true })))
console.log('    get "age":        ', benchmark.run(get, "age",  DS.runOptions({ returnValue: true })))
```

</details>

<details><summary>

### 7. Min heap</summary>

```js
// A binary heap stored as a linked structure.
// Each node tracks its parent, left child, and right child.
// Also tracks a "last" pointer on root for O(1) insert position access.
// insert: O(log n), getMin: O(1), extractMin: O(log n)
```
#### insert x5, extractMin x2
```js
const { ctx, benchmark } = DS.createStructure()

// root.heap = heap root node
// root.last = last inserted node (for sift-up)
// root.size = size node

const sizeNode = ctx.node(0)
ctx.set(ctx.root, "size", sizeNode)

function getMin(ctx) {
  const heap = ctx.get(ctx.root, "heap")
  if (!heap) return undefined
  return ctx.get(heap, VALUE)
}

function insert(ctx, value) {
  const newNode = ctx.node(value)
  const sizeNode = ctx.get(ctx.root, "size")
  const size = ctx.get(sizeNode, VALUE)
  ctx.set(sizeNode, VALUE, size + 1)

  if (!ctx.get(ctx.root, "heap")) {
    ctx.set(ctx.root, "heap", newNode)
    ctx.set(ctx.root, "last", newNode)
    return
  }

  // Find insert position via path encoded in binary representation of size+1
  const newSize = size + 1
  const path = []
  let n = newSize
  while (n > 1) { path.unshift(n % 2); n = Math.floor(n / 2) }

  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(ctx.root, "heap"))
  for (let i = 0; i < path.length - 1; i++) {
    const curr = ctx.get(ptr, "curr")
    ctx.set(ptr, "curr", path[i] === 0 ? ctx.get(curr, "left") : ctx.get(curr, "right"))
  }

  const parent = ctx.get(ptr, "curr")
  ctx.set(newNode, "parent", parent)
  if (path[path.length - 1] === 0) ctx.set(parent, "left", newNode)
  else ctx.set(parent, "right", newNode)
  ctx.set(ctx.root, "last", newNode)

  // Sift up
  const siftPtr = ctx.node(null)
  ctx.set(siftPtr, "curr", newNode)
  while (ctx.get(ctx.get(siftPtr, "curr"), "parent")) {
    const curr = ctx.get(siftPtr, "curr")
    const par = ctx.get(curr, "parent")
    if (ctx.get(curr, VALUE) < ctx.get(par, VALUE)) {
      const tmp = ctx.get(curr, VALUE)
      ctx.set(curr, VALUE, ctx.get(par, VALUE))
      ctx.set(par, VALUE, tmp)
      ctx.set(siftPtr, "curr", par)
    } else break
  }
}

console.log('    insert 10:', benchmark.run(insert, 10))
console.log('    insert 4: ', benchmark.run(insert, 4))
console.log('    insert 7: ', benchmark.run(insert, 7))
console.log('    insert 1: ', benchmark.run(insert, 1))
console.log('    insert 9: ', benchmark.run(insert, 9))
console.log('    getMin:   ', benchmark.run(getMin, DS.runOptions({ returnValue: true })))
```

</details>

<details><summary>

### 8. Directed graph (adjacency list)</summary>

```js
// Nodes represent vertices. Each node has a linked list of neighbour refs.
// Structure: root.nodes → vertex node, vertex.neighbours → neighbour chain
```
#### addVertex x4, addEdge x4, hasEdge
```js
const { ctx, benchmark } = DS.createStructure()

// Store a registry of named vertices off root
function addVertex(ctx, name) {
  const vertex = ctx.node(name)
  ctx.set(ctx.root, name, vertex)
}

function addEdge(ctx, from, to) {
  const fromVertex = ctx.get(ctx.root, from)
  const toVertex = ctx.get(ctx.root, to)
  // Prepend to neighbour chain
  const entry = ctx.node(null)
  ctx.set(entry, "ref", toVertex)
  ctx.set(entry, "next", ctx.get(fromVertex, "neighbours"))
  ctx.set(fromVertex, "neighbours", entry)
}

function hasEdge(ctx, from, to) {
  const fromVertex = ctx.get(ctx.root, from)
  const toVertex = ctx.get(ctx.root, to)
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(fromVertex, "neighbours"))
  while (ctx.get(ptr, "curr")) {
    const curr = ctx.get(ptr, "curr")
    if (ctx.get(curr, "ref") === toVertex) return true
    ctx.set(ptr, "curr", ctx.get(curr, "next"))
  }
  return false
}

console.log('    addVertex "A":    ', benchmark.run(addVertex, "A"))
console.log('    addVertex "B":    ', benchmark.run(addVertex, "B"))
console.log('    addVertex "C":    ', benchmark.run(addVertex, "C"))
console.log('    addVertex "D":    ', benchmark.run(addVertex, "D"))
console.log('    addEdge A→B:      ', benchmark.run(addEdge, "A", "B"))
console.log('    addEdge A→C:      ', benchmark.run(addEdge, "A", "C"))
console.log('    addEdge B→D:      ', benchmark.run(addEdge, "B", "D"))
console.log('    addEdge C→D:      ', benchmark.run(addEdge, "C", "D"))
console.log('    hasEdge A→B:      ', benchmark.run(hasEdge, "A", "B", DS.runOptions({ returnValue: true })))
console.log('    hasEdge A→D:      ', benchmark.run(hasEdge, "A", "D", DS.runOptions({ returnValue: true })))
```

</details>

<details><summary>

### 9. LRU cache (capacity 3)</summary>

```js
// Combines a hash map (O(1) lookup) with a doubly linked list (O(1) eviction).
// Most recently used sits at the head, least recently used at the tail.
// get and put are both O(1).
```
#### put x4 (triggers eviction), get x2
```js
const { ctx, benchmark } = DS.createStructure()
const CAPACITY = 3
const BUCKET_COUNT = 8

// Build buckets for hash map
for (let i = 0; i < BUCKET_COUNT; i++) {
  ctx.set(ctx.root, `b${i}`, ctx.node(null))
}

const capNode = ctx.node(CAPACITY)
const sizeNode = ctx.node(0)
ctx.set(ctx.root, "cap", capNode)
ctx.set(ctx.root, "size", sizeNode)

function hash(key) {
  let h = 0
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % BUCKET_COUNT
  return h
}

function detach(ctx, node) {
  const prev = ctx.get(node, "prev")
  const next = ctx.get(node, "next")
  if (prev) ctx.set(prev, "next", next)
  else ctx.set(ctx.root, "head", next)
  if (next) ctx.set(next, "prev", prev)
  else ctx.set(ctx.root, "tail", prev)
  ctx.set(node, "prev", null)
  ctx.set(node, "next", null)
}

function prepend(ctx, node) {
  const head = ctx.get(ctx.root, "head")
  ctx.set(node, "next", head)
  ctx.set(node, "prev", null)
  if (head) ctx.set(head, "prev", node)
  else ctx.set(ctx.root, "tail", node)
  ctx.set(ctx.root, "head", node)
}

function mapGet(ctx, key) {
  const bucket = ctx.get(ctx.root, `b${hash(key)}`)
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", ctx.get(bucket, "head"))
  while (ctx.get(ptr, "curr")) {
    const curr = ctx.get(ptr, "curr")
    if (ctx.get(curr, "key") === key) return curr
    ctx.set(ptr, "curr", ctx.get(curr, "next"))
  }
  return null
}

function mapSet(ctx, key, node) {
  const bucket = ctx.get(ctx.root, `b${hash(key)}`)
  const entry = ctx.node(null)
  ctx.set(entry, "key", key)
  ctx.set(entry, "node", node)
  ctx.set(entry, "next", ctx.get(bucket, "head"))
  ctx.set(bucket, "head", entry)
}

function put(ctx, key, value) {
  const existing = mapGet(ctx, key)
  if (existing) {
    const dataNode = ctx.get(existing, "node")
    ctx.set(dataNode, VALUE, value)
    detach(ctx, dataNode)
    prepend(ctx, dataNode)
    return
  }

  const sizeNode = ctx.get(ctx.root, "size")
  const capNode = ctx.get(ctx.root, "cap")
  const size = ctx.get(sizeNode, VALUE)
  const cap = ctx.get(capNode, VALUE)

  if (size >= cap) {
    // Evict LRU (tail)
    const lru = ctx.get(ctx.root, "tail")
    detach(ctx, lru)
    ctx.set(sizeNode, VALUE, size - 1)
  }

  const dataNode = ctx.node(value)
  ctx.set(dataNode, "key", key)
  prepend(ctx, dataNode)
  mapSet(ctx, key, dataNode)
  ctx.set(sizeNode, VALUE, ctx.get(sizeNode, VALUE) + 1)
}

function get(ctx, key) {
  const entry = mapGet(ctx, key)
  if (!entry) return -1
  const dataNode = ctx.get(entry, "node")
  detach(ctx, dataNode)
  prepend(ctx, dataNode)
  return ctx.get(dataNode, VALUE)
}

console.log('    put(1,1):', benchmark.run(put, 1, 1))
console.log('    put(2,2):', benchmark.run(put, 2, 2))
console.log('    put(3,3):', benchmark.run(put, 3, 3))
console.log('    put(4,4):', benchmark.run(put, 4, 4))  // evicts key 1
console.log('    get(1):  ', benchmark.run(get, 1, DS.runOptions({ returnValue: true })))  // -1, evicted
console.log('    get(3):  ', benchmark.run(get, 3, DS.runOptions({ returnValue: true })))  // 3
```

</details>

<details><summary>

### 10. Circular linked list</summary>

```js
// The tail's next points back to head, forming a cycle.
// Useful for round-robin scheduling, ring buffers.
// Structure: root.head → node → node → node → (back to head)
```
#### append x3, traverse full circle
```js
const { ctx, benchmark } = DS.createStructure()

function append(ctx, value) {
  const newNode = ctx.node(value)
  const head = ctx.get(ctx.root, "head")
  if (!head) {
    ctx.set(ctx.root, "head", newNode)
    ctx.set(ctx.root, "tail", newNode)
    ctx.set(newNode, "next", newNode)  // points to itself
    return
  }
  const tail = ctx.get(ctx.root, "tail")
  ctx.set(tail, "next", newNode)
  ctx.set(newNode, "next", head)       // close the circle
  ctx.set(ctx.root, "tail", newNode)
}

// Traverse exactly one full loop, collecting values
function traverseCircle(ctx) {
  const head = ctx.get(ctx.root, "head")
  if (!head) return
  const ptr = ctx.node(null)
  ctx.set(ptr, "curr", head)
  // Use a counter node to limit traversal to one full cycle
  const counter = ctx.node(0)
  const sizeNode = ctx.get(ctx.root, "size")
  const size = ctx.get(sizeNode, VALUE)
  ctx.set(counter, VALUE, 0)
  while (ctx.get(counter, VALUE) < size) {
    const curr = ctx.get(ptr, "curr")
    ctx.set(ptr, "curr", ctx.get(curr, "next"))
    ctx.set(counter, VALUE, ctx.get(counter, VALUE) + 1)
  }
}

const sizeNode = ctx.node(0)
ctx.set(ctx.root, "size", sizeNode)

function appendWithSize(ctx, value) {
  append(ctx, value)
  const s = ctx.get(ctx.root, "size")
  ctx.set(s, VALUE, ctx.get(s, VALUE) + 1)
}

console.log('    append "a":', benchmark.run(appendWithSize, "a"))
console.log('    append "b":', benchmark.run(appendWithSize, "b"))
console.log('    append "c":', benchmark.run(appendWithSize, "c"))
console.log('    traverse:  ', benchmark.run(traverseCircle))
```

</details>

</details>
