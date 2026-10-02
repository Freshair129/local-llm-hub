// src/js/swarm.js
// trace:implements FEAT-031
// trace:implements DIST-SWARM-001
// Frontend controller for Multi-Node Swarm Worker Offloader over LAN

import { invoke } from './api.js';

export async function registerWorkerNode(nodeId, host, port = 11434, vramFreeMb = 12288) {
  try {
    const node = await invoke('register_worker_node', {
      nodeId,
      host,
      port,
      vramFreeMb
    });
    console.log('[INFO:swarm] Registered worker node successfully:', node);
    return node;
  } catch (err) {
    console.error('[ERROR:swarm] Failed to register worker node:', err);
    throw err;
  }
}

export async function getWorkerNodes() {
  try {
    const nodes = await invoke('list_worker_nodes');
    return nodes || [];
  } catch (err) {
    console.error('[ERROR:swarm] Failed to list worker nodes:', err);
    return [];
  }
}

export async function offloadSwarmTask(nodeId, model, prompt, maxTokens = null) {
  try {
    const response = await invoke('offload_swarm_task', {
      nodeId,
      task: {
        task_id: `task_${Date.now()}`,
        model,
        prompt,
        max_tokens: maxTokens
      }
    });
    console.log(`[INFO:swarm] Task offloaded to ${nodeId} successfully.`);
    return response;
  } catch (err) {
    console.error(`[ERROR:swarm] Swarm task offload failed for node ${nodeId}:`, err);
    throw err;
  }
}
