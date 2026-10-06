// trace:verifies FR-007
// trace:verifies FR-006
// trace:verifies FR-011
// trace:verifies FR-023
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

async function desktop(invoke, stubs = {}) {
  const elements = new Map();
  class Element {
    constructor() {
      this.children = []; this.value = ''; this.textContent = ''; this.style = {};
      this.listeners = {}; this.options = []; this.disabled = false;
      const classes = new Set();
      this.classList = { add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v) };
    }
    set innerHTML(value) {
      this.html = value; this.children = []; this.options = [];
      for (const match of value.matchAll(/<option value="([^"]*)"[^>]*>(.*?)<\/option>/g)) {
        const option = new Element(); option.value = match[1]; option.textContent = match[2]; this.appendChild(option);
      }
    }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { this.children.push(child); this.options.push(child); if (child.id) elements.set(child.id, child); return child; }
    replaceChildren(...children) { this.children = []; this.options = []; children.forEach(child => this.appendChild(child)); }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    remove() { elements.delete(this.id); }
    get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    set selectedIndex(index) { this.value = this.options[index]?.value || ''; }
    getAttribute(name) { return this[name]; }
  }
  for (const id of ['view-arena','arena-model-a-select','arena-model-b-select','arena-persona-select',
    'btn-run-arena','arena-prompt-input','arena-output-a','arena-output-b','arena-col-a','arena-col-b',
    'a-tps','b-tps','a-ttft','b-ttft','a-tokens','b-tokens','chat-model-select','chat-persona-select',
    'chat-send-btn','chat-user-input','chat-messages-container']) elements.set(id, new Element());
  const document = { getElementById: id => elements.get(id), createElement: () => new Element(), querySelectorAll: () => [], addEventListener: () => {} };
  const context = vm.createContext({document, window:{__TAURI__:{core:{invoke}}}, performance, setTimeout, clearTimeout, console});
  const cache = new Map();
  async function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const exports = stubs[path.basename(filename)];
    const stub = filename.endsWith('stats.js') ? 'recordTaskExecution' : filename.endsWith('toast.js') ? 'showToast' : null;
    const module = exports ? new vm.SyntheticModule(Object.keys(exports), function() {
      for (const [name,value] of Object.entries(exports)) this.setExport(name,value);
    }, {context}) : stub ? new vm.SyntheticModule([stub], function() { this.setExport(stub, () => {}); }, {context})
      : new vm.SourceTextModule(await fs.readFile(filename, 'utf8'), {context, identifier: filename});
    cache.set(filename, module);
    await module.link((specifier, parent) => load(path.resolve(path.dirname(parent.identifier), specifier)));
    return module;
  }
  const state = await load('src/js/state.js'); await state.evaluate();
  return { elements, store: state.namespace.store, async module(name) { const value = await load(`src/js/${name}.js`); await value.evaluate(); return value.namespace; } };
}

const options = [
  {id:'logical-a',name:'Model A',model:'logical-a',backend:'hub'},
  {id:'vllm:physical',name:'Model B',model:'physical',backend:'vllm'},
];
const reply = {role:'assistant',content:'canonical answer',prompt_tokens:8,completion_tokens:4,duration_ms:100,tps:40};

test('Arena sends the selected wire model/backend and renders canonical response with no invented metrics', async () => {
  const calls = [];
  const ui = await desktop(async (cmd, args) => { calls.push({cmd,args}); return reply; });
  ui.store.setState({inferenceCatalog:{mode:'hub',models:options,error:null,loading:false}, models:options});
  const arena = await ui.module('arena'); arena.initArena();
  ui.elements.get('arena-model-a-select').value = options[0].id;
  ui.elements.get('arena-model-b-select').value = options[1].id;
  ui.elements.get('arena-prompt-input').value = 'hello';
  await ui.elements.get('btn-run-arena').listeners.click[0]();
  assert.equal(calls[0].args.request?.model, 'logical-a');
  assert.equal(calls[1].args.request?.model, 'physical');
  assert.equal(calls[1].args.request?.backend, 'vllm');
  assert.match(ui.elements.get('arena-output-a').innerHTML, /canonical answer/);
  assert.equal(ui.elements.get('a-ttft').textContent, 'Not measured');
  assert.equal(ui.elements.get('a-tokens').textContent, 4);
  assert.equal(ui.elements.get('btn-run-arena').disabled, false);
});

test('Arena unknown usage stays unavailable and cannot win; stale selections are cleared', async () => {
  const ui = await desktop(async () => ({...reply,completion_tokens:0,tps:0}));
  ui.store.setState({inferenceCatalog:{mode:'hub',models:options,error:null,loading:false},models:options});
  const arena = await ui.module('arena'); arena.initArena();
  ui.elements.get('arena-model-a-select').value = options[0].id;
  ui.elements.get('arena-model-b-select').value = options[1].id;
  ui.elements.get('arena-prompt-input').value = 'hello';
  await ui.elements.get('btn-run-arena').listeners.click[0]();
  assert.equal(ui.elements.get('a-tokens').textContent, 'Not reported');
  assert.equal(ui.elements.get('a-tps').textContent, 'Not measured');
  assert.equal(ui.elements.get('arena-col-a').classList.contains('arena-winner'), false);
  ui.store.setState({inferenceCatalog:{mode:null,models:[],error:'Hub unavailable',loading:false}});
  arena.populateArenaModelSelectors();
  assert.equal(ui.elements.get('arena-model-a-select').value, '');
  assert.equal(ui.elements.get('btn-run-arena').disabled, true);
});

test('Chat uses logical catalog model; failed refresh disables send rather than retaining legacy model', async () => {
  const calls=[];
  const ui=await desktop(async (cmd,args) => {calls.push({cmd,args});return reply;});
  ui.store.setState({inferenceCatalog:{mode:'hub',models:options,error:null,loading:false}});
  const chat=await ui.module('chat');chat.initChat();
  ui.elements.get('chat-user-input').value='hello';await chat.sendMessage();
  assert.equal(calls[0]?.args.request.model,'logical-a');
  ui.store.setState({inferenceCatalog:{mode:null,models:[],error:'Hub unavailable',loading:false}});
  chat.initChat();ui.elements.get('chat-user-input').value='do not send';await chat.sendMessage();
  assert.equal(calls.length,1);
  assert.equal(ui.elements.get('chat-send-btn').disabled,true);
});

test('Catalog refresh fails closed and late results cannot replace a newer catalog', async () => {
  let resolveFirst;
  let count=0;
  const ui=await desktop(async () => {
    count++;
    if(count===1) return await new Promise(resolve => {resolveFirst=resolve;});
    throw new Error('HUB_UNAVAILABLE');
  });
  const catalog=await ui.module('inference-catalog');
  const first=catalog.refreshInferenceCatalog();
  await catalog.refreshInferenceCatalog();
  resolveFirst({mode:'legacy',models:options});await first;
  assert.equal(ui.store.state.inferenceCatalog.models.length,0);
  assert.match(ui.store.state.inferenceCatalog.error,/HUB_UNAVAILABLE/);
});

test('Chat preserves a valid selection and prevents duplicate send or persona changes while pending', async () => {
  let resolve;
  let calls=0;
  const ui=await desktop(async () => {calls++;return new Promise(done => {resolve=done;});});
  ui.store.setState({inferenceCatalog:{mode:'legacy',models:options,error:null,loading:false}});
  const chat=await ui.module('chat');chat.initChat();
  const select=ui.elements.get('chat-model-select');
  select.value=options[1].id;select.onchange();chat.initChat();
  assert.equal(select.value,options[1].id);
  ui.elements.get('chat-user-input').value='first';
  const pending=chat.sendMessage();
  assert.equal(select.disabled,true);
  assert.equal(ui.elements.get('chat-persona-select').disabled,true);
  ui.elements.get('chat-user-input').value='second';await chat.sendMessage();
  assert.equal(calls,1);
  resolve(reply);await pending;
  assert.equal(select.disabled,false);
});

test('Arena retains its busy guard until the other request settles after one failure', async () => {
  let resolve;
  let calls=0;
  const ui=await desktop(async () => {
    if(++calls===1) throw new Error('Hub unavailable');
    return await new Promise(done => {resolve=done;});
  });
  ui.store.setState({inferenceCatalog:{mode:'hub',models:options,error:null,loading:false}});
  const arena=await ui.module('arena');arena.initArena();
  ui.elements.get('arena-prompt-input').value='hello';
  const button=ui.elements.get('btn-run-arena');
  const pending=button.listeners.click[0]();
  await new Promise(done => setImmediate(done));
  assert.equal(button.disabled,true);
  assert.equal(ui.elements.get('arena-model-a-select').disabled,true);
  await button.listeners.click[0]();assert.equal(calls,2);
  resolve(reply);await pending;
  assert.equal(button.disabled,false);
  assert.equal(ui.elements.get('arena-model-a-select').disabled,false);
  assert.match(ui.elements.get('arena-output-a').innerHTML,/Hub unavailable/);
  assert.equal(ui.elements.get('arena-col-b').classList.contains('arena-winner'),false);
});

test('Telemetry cannot start overlapping batches while a slow sensor refresh is pending', async () => {
  let release;
  let calls=0;
  const ui=await desktop(async () => {calls++;return {};}, {
    'digital_twin_3d.js':{updateDigitalTwinTelemetry:() => {}},
    'cpu_telemetry.js':{refreshCpuTelemetry:() => new Promise(done => {release=done;})},
    'gpu_tuning.js':{refreshGpuTelemetry:async () => {}},
    'hardware_surfaces.js':{refreshHardwareSurfaces:async () => {}},
    'process_manager.js':{refreshProcesses:async () => {}},
  });
  const telemetry=await ui.module('observability');
  const pending=telemetry.fetchHardwareTelemetry();
  await new Promise(done => setImmediate(done));
  await telemetry.fetchHardwareTelemetry();
  assert.equal(calls,1);
  release();await pending;
  const next=telemetry.fetchHardwareTelemetry();
  await new Promise(done => setImmediate(done));
  assert.equal(calls,2);
  release();await next;
});
