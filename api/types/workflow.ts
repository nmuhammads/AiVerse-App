export type WorkflowNodeType = 'prompt' | 'image.generate' | 'video.generate' | 'video.concat'
export type WorkflowRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type WorkflowNodeStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped'

export interface WorkflowNodeData {
  model?: string
  mode?: 't2v' | 'i2v'
  prompt?: string
  text?: string
  ref_source?: 'upstream' | 'upload' | 'mixed'
  selected_upstream_node_id?: string | 'all'
  selected_start_upstream_node_id?: string | 'auto'
  selected_end_upstream_node_id?: string | 'none'
  ref_images?: string[]
  aspect_ratio?: string
  image_count?: number
  video_duration?: string
  video_resolution?: string
  fixed_lens?: boolean
  generate_audio?: boolean
  kling_duration?: string
  kling_sound?: boolean
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  position?: { x: number; y: number }
  data?: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  data?: {
    order?: number
  }
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type NodeArtifact =
  | { type: 'prompt'; text: string }
  | { type: 'image'; image_urls: string[]; generation_ids: number[] }
  | { type: 'video'; video_url: string; generation_ids: number[] }

export interface WorkflowTemplateRecord {
  id: number
  user_id: number
  name: string
  description: string | null
  graph: WorkflowGraph
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowRunNodeState {
  status: WorkflowNodeStatus
  started_at?: string
  finished_at?: string
  generation_ids?: number[]
  output?: NodeArtifact | null
  error?: string | null
}

export interface WorkflowRunRecord {
  id: number
  workflow_id: number
  user_id: number
  status: WorkflowRunStatus
  current_node_id: string | null
  progress: number
  node_states: Record<string, WorkflowRunNodeState>
  generation_ids: number[]
  outputs: Record<string, NodeArtifact>
  error: { message: string } | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}
