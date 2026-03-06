import { create } from 'zustand'
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowRunDTO,
  WorkflowRunStatus,
  WorkflowTemplateDTO,
} from '@aiverse/shared/types/workflow'

const DEFAULT_GRAPH: WorkflowGraph = {
  nodes: [
    {
      id: 'image-1',
      type: 'image.generate',
      position: { x: 120, y: 110 },
      data: {
        model: 'gpt-image-1.5',
        gpt_image_quality: 'medium',
        resolution: '1K',
        aspect_ratio: '3:4',
        image_count: 1,
        prompt: 'cinematic neon city at night, rainy street, depth of field',
        ref_source: 'upstream',
        selected_upstream_node_id: 'all',
        ref_images: [],
      },
    },
    {
      id: 'video-1',
      type: 'video.generate',
      position: { x: 430, y: 260 },
      data: {
        model: 'seedance-1.5-pro',
        mode: 'i2v',
        video_duration: '8',
        video_resolution: '720p',
        generate_audio: false,
        kling_duration: '5',
        kling_sound: false,
        prompt: 'camera slowly pushes forward, wet asphalt reflections, cinematic movement',
        ref_source: 'upstream',
        selected_upstream_node_id: 'all',
        selected_start_upstream_node_id: 'auto',
        selected_end_upstream_node_id: 'none',
        ref_images: [],
      },
    },
  ],
  edges: [
    { id: 'e-image-video', source: 'image-1', target: 'video-1' },
  ],
}

type WorkflowStoreState = {
  graph: WorkflowGraph
  selectedNodeId: string | null
  dirty: boolean
  templates: WorkflowTemplateDTO[]
  activeTemplateId: number | null
  activeRunId: number | null
  runStatus: WorkflowRunStatus | null
  run: WorkflowRunDTO | null
}

type WorkflowStoreActions = {
  resetDraft: () => void
  setGraph: (graph: WorkflowGraph) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setDirty: (dirty: boolean) => void
  setTemplates: (templates: WorkflowTemplateDTO[]) => void
  setActiveTemplateId: (templateId: number | null) => void
  setActiveRun: (runId: number | null, status: WorkflowRunStatus | null) => void
  setRun: (run: WorkflowRunDTO | null) => void
  updateNodeData: (nodeId: string, patch: Partial<WorkflowNode['data']>) => void
}

export const useWorkflowStore = create<WorkflowStoreState & WorkflowStoreActions>((set) => ({
  graph: DEFAULT_GRAPH,
  selectedNodeId: 'image-1',
  dirty: false,
  templates: [],
  activeTemplateId: null,
  activeRunId: null,
  runStatus: null,
  run: null,

  resetDraft: () => set({
    graph: DEFAULT_GRAPH,
    selectedNodeId: 'image-1',
    dirty: false,
    activeTemplateId: null,
    activeRunId: null,
    runStatus: null,
    run: null,
  }),

  setGraph: (graph) => set({ graph }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setDirty: (dirty) => set({ dirty }),
  setTemplates: (templates) => set({ templates }),
  setActiveTemplateId: (activeTemplateId) => set({ activeTemplateId }),
  setActiveRun: (activeRunId, runStatus) => set({ activeRunId, runStatus }),
  setRun: (run) => set({ run, runStatus: run?.status ?? null, activeRunId: run?.id ?? null }),

  updateNodeData: (nodeId, patch) => set((state) => ({
    graph: {
      ...state.graph,
      nodes: state.graph.nodes.map((node) => {
        if (node.id !== nodeId) return node
        return {
          ...node,
          data: {
            ...node.data,
            ...patch,
          },
        }
      }),
    },
    dirty: true,
  })),
}))

export function getDefaultWorkflowGraph() {
  return DEFAULT_GRAPH
}
