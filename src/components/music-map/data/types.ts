export type SliderStopId = "audio" | "balanced" | "mood";

export interface PositionRecord {
  id: string;
  audio: [number, number];
  balanced: [number, number];
  mood: [number, number];
}

export interface MetadataRecord {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  clusterId: number;
  atlasIndex: number;
  atlasUV: [number, number, number, number];
}

export interface RegionStop {
  centroid: [number, number];
  radius: number;
}

export interface RegionRecord {
  clusterId: number;
  label: string;
  color: string;
  stops: Record<SliderStopId, RegionStop>;
}

export interface MapData {
  positions: PositionRecord[];
  metadata: MetadataRecord[];
  regions: RegionRecord[];
  atlasUrls: string[];
}
