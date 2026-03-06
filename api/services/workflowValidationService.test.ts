import test from 'node:test'
import assert from 'node:assert/strict'
import type { WorkflowGraph, WorkflowNode } from '../types/workflow.js'
import { validateWorkflowGraph } from './workflowValidationService.js'

function imageNode(id: string): WorkflowNode {
  return {
    id,
    type: 'image.generate',
    data: {
      model: 'gpt-image-1.5',
      prompt: 'img',
      image_count: 1,
    },
  }
}

function seedanceNode(id: string): WorkflowNode {
  return {
    id,
    type: 'video.generate',
    data: {
      model: 'seedance-1.5-pro',
      mode: 'i2v',
      prompt: 'video',
      ref_source: 'upstream',
    },
  }
}

function validate(graph: WorkflowGraph) {
  const result = validateWorkflowGraph(graph)
  return {
    ok: result.ok,
    codes: result.errors.map((e) => e.code),
  }
}

test('seedance i2v with only start_image handle is valid', () => {
  const graph: WorkflowGraph = {
    nodes: [imageNode('img1'), seedanceNode('v1')],
    edges: [
      { id: 'e1', source: 'img1', target: 'v1', targetHandle: 'start_image' },
    ],
  }

  const result = validate(graph)
  assert.equal(result.ok, true)
})

test('seedance i2v with start+end handles is valid', () => {
  const graph: WorkflowGraph = {
    nodes: [imageNode('img1'), imageNode('img2'), seedanceNode('v1')],
    edges: [
      { id: 'e1', source: 'img1', target: 'v1', targetHandle: 'start_image' },
      { id: 'e2', source: 'img2', target: 'v1', targetHandle: 'end_image' },
    ],
  }

  const result = validate(graph)
  assert.equal(result.ok, true)
})

test('seedance i2v rejects two edges into start_image', () => {
  const graph: WorkflowGraph = {
    nodes: [imageNode('img1'), imageNode('img2'), seedanceNode('v1')],
    edges: [
      { id: 'e1', source: 'img1', target: 'v1', targetHandle: 'start_image' },
      { id: 'e2', source: 'img2', target: 'v1', targetHandle: 'start_image' },
    ],
  }

  const result = validate(graph)
  assert.equal(result.ok, false)
  assert.ok(result.codes.includes('seedance_start_handle_too_many_inputs'))
})

test('kling-i2v without image input is invalid', () => {
  const graph: WorkflowGraph = {
    nodes: [
      {
        id: 'v1',
        type: 'video.generate',
        data: { model: 'kling-i2v', prompt: 'video', ref_source: 'upstream' },
      },
    ],
    edges: [],
  }

  const result = validate(graph)
  assert.equal(result.ok, false)
  assert.ok(result.codes.includes('kling_i2v_inputs'))
})

test('kling-t2v with image input is invalid', () => {
  const graph: WorkflowGraph = {
    nodes: [
      imageNode('img1'),
      {
        id: 'v1',
        type: 'video.generate',
        data: { model: 'kling-t2v', prompt: 'video', ref_source: 'upstream' },
      },
    ],
    edges: [
      { id: 'e1', source: 'img1', target: 'v1' },
    ],
  }

  const result = validate(graph)
  assert.equal(result.ok, false)
  assert.ok(result.codes.includes('kling_t2v_inputs'))
})
