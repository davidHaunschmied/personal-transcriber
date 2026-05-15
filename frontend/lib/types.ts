export type RecordingStatus = "uploaded" | "transcribing" | "transcribed" | "failed";
export type TransformationStatus = "pending" | "running" | "done" | "failed";

export interface Recording {
  id: string;
  original_filename: string;
  storage_path: string;
  duration_seconds: number | null;
  status: RecordingStatus;
  transcript: string | null;
  error: string | null;
  created_at: string;
}

export interface RecordingRegistered {
  recording: Recording;
  upload_url: string;
  upload_token: string;
  storage_path: string;
}

export interface Transformation {
  id: string;
  recording_id: string;
  template_id: string | null;
  prompt_used: string;
  model: string;
  output: string | null;
  status: TransformationStatus;
  error: string | null;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  model: string;
  is_default: boolean;
  created_at: string;
}

export interface StyleGuide {
  content: string;
  updated_at: string | null;
}

export interface ReferenceSpeech {
  id: string;
  title: string;
  content: string;
  created_at: string;
}
