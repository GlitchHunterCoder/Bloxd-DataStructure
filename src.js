const VALUE = Symbol('value')

function createLedger() {
  const root = { [VALUE]: null }
  const nodes = [root]
  return { nodes, root }
}

function _createNode(ledger, value) {
  const node = { [VALUE]: value }
  ledger.nodes.push(node)
  return node
}

function createCtx(ledger, recorder) {
  return {
    get root() { return ledger.root },
    node(value) {
      recorder.record('node', null, null, value)
      return _createNode(ledger, value)
    },
    get(node, key) {
      recorder.record('get', node, key, undefined)
      return node[key]
    },
    set(node, key, value) {
      recorder.record('set', node, key, value)
      node[key] = value
    },
    delete(node, key) {
      recorder.record('delete', node, key, undefined)
      delete node[key]
    }
  }
}

function createBenchmark(costFn) {
  let _log = []
  let _counters = { gets: 0, sets: 0, deletes: 0, nodes: 0 }
  let _recording = false

  const recorder = {
    record(type, node, key, value) {
      if (!_recording) return
      if (type === 'get')    _counters.gets++
      if (type === 'set')    _counters.sets++
      if (type === 'delete') _counters.deletes++
      if (type === 'node')   _counters.nodes++
      if (costFn) costFn(type, node, key, value, _counters)
      _log.push({ type, key, value, timestamp: _log.length })
    }
  }

  return {
    _recorder: recorder,
    run(operation, ...args) {
      let options = {}
      if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1]?._dsOptions) {
        options = args.pop()
      }
      const debug = options.debug ?? false
      const includeReturnValue = options.returnValue ?? false

      _log = []
      _counters = { gets: 0, sets: 0, deletes: 0, nodes: 0 }
      _recording = true

      let returnValue
      try { returnValue = operation(...args) }
      finally { _recording = false }

      const report = { ...(_counters) }
      if (debug) report.log = [..._log]
      if (includeReturnValue) report.returnValue = returnValue
      return report
    }
  }
}

function runOptions(opts = {}) {
  return { ...opts, _dsOptions: true }
}

function createStructure(costFn) {
  const ledger = createLedger()
  const benchmark = createBenchmark(costFn)
  const ctx = createCtx(ledger, benchmark._recorder)
  const _run = benchmark.run.bind(benchmark)
  benchmark.run = (operation, ...args) => _run((...a) => operation(ctx, ...a), ...args)
  return { ctx, benchmark, ledger }
}

const DS = { VALUE, createStructure, runOptions }
