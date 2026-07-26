export interface Entity {
  type: string;
  value: string;
  raw: string;
  confidence: number;
}

export interface ExtractedEntities {
  [type: string]: Entity[];
}
